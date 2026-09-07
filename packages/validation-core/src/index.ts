import { randomUUID } from "node:crypto";
import type { LayerResult, QRArtifact, ResultStatus, ValidationFinding, ValidationSession, XMLArtifact } from "../../shared-types/src/index.ts";
import { DISCLAIMER_AR, DISCLAIMER_EN } from "../../shared-types/src/index.ts";
import { inspectQr } from "../../qr-tlv/src/index.ts";
import { inspectXmlFile } from "../../xml-validator/src/index.ts";
import { inspectBusiness } from "../../business-rules/src/index.ts";
import { inspectCrypto } from "../../crypto-validator/src/index.ts";
import { inspectSchemas } from "../../schema-runner/src/index.ts";
import { rulesetInfo } from "../../rulesets/src/index.ts";

export const APP_VERSION = "0.1.0-beta";

const QR_SOURCE = {
  document: "ZATCA Guide to Developed FATOORA Compliant QR Code",
  rule_reference: "TLV vs XML shared fields",
  url: "https://zatca.gov.sa/en/E-Invoicing/SystemsDevelopers/Documents/QRCodeCreation.pdf",
  ruleset_version: "2021-11-18",
  published_date: "2021-11-18",
};

export function rollupStatus(layers: Array<{ status: ResultStatus; checked?: boolean }>): ResultStatus {
  if (!layers.length) return "NOT_CHECKED";
  const statuses = layers.map((l) => l.status);
  if (statuses.includes("FAILED")) return "FAILED";
  if (statuses.includes("UNSUPPORTED_RULESET")) return "UNSUPPORTED_RULESET";
  if (statuses.includes("INCONCLUSIVE")) return "INCONCLUSIVE";
  const material = layers.filter((l) => l.status !== "NOT_APPLICABLE");
  const checkedMaterial = material.filter((l) => l.checked !== false && l.status !== "NOT_CHECKED");
  const hasUnchecked = material.some((l) => l.status === "NOT_CHECKED" || l.checked === false);
  if (checkedMaterial.length && hasUnchecked) return "INCONCLUSIVE";
  if (!checkedMaterial.length) return "NOT_CHECKED";
  if (checkedMaterial.every((l) => l.status === "PASS_OFFICIAL_SDK")) return "PASS_OFFICIAL_SDK";
  if (checkedMaterial.every((l) => l.status === "PASS_LOCAL_RULES" || l.status === "PASS_OFFICIAL_SDK")) {
    return "PASS_LOCAL_RULES";
  }
  return "INCONCLUSIVE";
}

function money(v?: string | null): number | null {
  if (v == null || v === "") return null;
  const n = Number(String(v).replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

function qrField(qr: QRArtifact, tag: number): string | null {
  return qr.fields.find((f) => f.tag === tag)?.textValue ?? null;
}

export function crossCheck(qr?: QRArtifact, xml?: XMLArtifact): { findings: ValidationFinding[]; status: ResultStatus } {
  if (!qr || !xml || xml.rejected) return { findings: [], status: "NOT_APPLICABLE" };
  const mismatches: string[] = [];
  const seller = qrField(qr, 1);
  const vat = qrField(qr, 2);
  const total = money(qrField(qr, 4));
  const tax = money(qrField(qr, 5));
  if (seller && xml.sellerName && seller.trim() !== String(xml.sellerName).trim()) mismatches.push("sellerName");
  if (vat && xml.vatNumber && vat.trim() !== String(xml.vatNumber).trim()) mismatches.push("vatNumber");
  const xmlTotal = money(xml.payableAmount) ?? money(xml.taxInclusiveAmount);
  if (total != null && xmlTotal != null && Math.abs(total - xmlTotal) >= 0.02) mismatches.push("total");
  if (tax != null && money(xml.taxAmount) != null && Math.abs(tax - money(xml.taxAmount)!) >= 0.02) mismatches.push("vatAmount");
  const base = {
    layer: "cross" as const,
    category: "cross-check",
    source: QR_SOURCE,
    suggested_action_ar: "راجع المصدرين على الجهاز.",
    suggested_action_en: "Review both inputs on-device.",
    auto_fix_available: false,
    message_ar: "",
    message_en: "",
  };
  if (mismatches.length) {
    const findings: ValidationFinding[] = [{
      ...base,
      id: "XCHECK-MISMATCH",
      severity: "error",
      status: "FAILED",
      title_ar: "الرمز لا يطابق XML",
      title_en: "QR fields do not match XML",
      evidence: { related_fields: mismatches },
    }];
    return { status: "FAILED", findings };
  }
  return {
    status: "PASS_LOCAL_RULES",
    findings: [{
      ...base,
      id: "XCHECK-OK",
      severity: "info",
      status: "PASS_LOCAL_RULES",
      title_ar: "الحقول المشتركة متوافقة",
      title_en: "Shared fields match",
      evidence: {},
    }],
  };
}

export interface ValidateInput {
  qrBase64?: string;
  xmlText?: string;
  xmlFileName?: string;
  schemaDir?: string;
}

export function validateSession(input: ValidateInput): ValidationSession {
  const findings: ValidationFinding[] = [];
  const layers: LayerResult[] = [];
  let qrArt: QRArtifact | undefined;
  let xmlArt: XMLArtifact | undefined;
  if (input.qrBase64) {
    const qr = inspectQr(input.qrBase64);
    qrArt = qr.artifact;
    findings.push(...qr.findings);
    layers.push({ layer: "qr", status: qr.status, checked: true, findings: qr.findings });
  }
  if (input.xmlText) {
    const xml = inspectXmlFile(input.xmlText, input.xmlFileName);
    xmlArt = xml.artifact;
    findings.push(...xml.findings);
    layers.push({ layer: xml.artifact.rejected ? "file" : "xml", status: xml.status, checked: true, findings: xml.findings });
  }
  if (qrArt || xmlArt) {
    const biz = inspectBusiness({ xmlText: input.xmlText, xml: xmlArt, qr: qrArt });
    findings.push(...biz.findings);
    layers.push({ layer: "business", status: biz.status, checked: biz.status !== "NOT_CHECKED" && biz.status !== "NOT_APPLICABLE" });
    const crypto = inspectCrypto();
    findings.push(...crypto.findings);
    layers.push({ layer: "crypto", status: crypto.status, checked: true, findings: crypto.findings });
    if (qrArt && xmlArt && !xmlArt.rejected) {
      const cross = crossCheck(qrArt, xmlArt);
      findings.push(...cross.findings);
      layers.push({ layer: "cross", status: cross.status, checked: true, findings: cross.findings });
    }
  }
  const schemas = inspectSchemas(input.schemaDir);
  findings.push(...schemas.findings);
  layers.push({ layer: "xsd", status: schemas.status, checked: false, findings: schemas.findings });
  const sdkFinding: ValidationFinding = {
    id: "SDK-NOT-CHECKED",
    layer: "sdk",
    severity: "info",
    category: "sdk",
    status: "NOT_CHECKED",
    title_ar: "SDK غير مستدعى",
    title_en: "SDK not invoked",
    message_ar: "المحرك الرسمي غير مضمّن. المقارنة التفاضلية اختيارية على جهازك.",
    message_en: "The official SDK is not bundled. Differential compare is optional on your machine.",
    source: {
      document: "ZATCA SDK — user-installed only",
      rule_reference: "not vendored",
      url: "https://zatca.gov.sa/en/E-Invoicing/SystemsDevelopers/ComplianceEnablementToolbox/Pages/DownloadSDK.aspx",
      ruleset_version: "user-supplied",
    },
    evidence: {},
    suggested_action_ar: "لا توزّع SDK داخل المنتج.",
    suggested_action_en: "Do not vendor the SDK.",
    auto_fix_available: false,
  };
  findings.push(sdkFinding);
  layers.push({ layer: "sdk", status: "NOT_CHECKED", checked: false, findings: [sdkFinding] });
  const overall = rollupStatus(layers);
  return {
    id: randomUUID(),
    created_at: new Date().toISOString(),
    app_version: APP_VERSION,
    ruleset: rulesetInfo(),
    invoice_type: "unknown",
    inputs: { qr: Boolean(input.qrBase64), xml: Boolean(input.xmlText) },
    layers,
    findings,
    overall_status: overall,
    disclaimer_ar: DISCLAIMER_AR,
    disclaimer_en: DISCLAIMER_EN,
    qr: qrArt,
    xml: xmlArt,
  };
}

export function validateQr(qrBase64: string) {
  return validateSession({ qrBase64 });
}

export function validateXmlText(xmlText: string, xmlFileName?: string) {
  return validateSession({ xmlText, xmlFileName });
}
