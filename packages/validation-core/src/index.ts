import { randomUUID } from "node:crypto";
import type { LayerResult, ResultStatus, ValidationFinding, ValidationSession } from "../../shared-types/src/index.ts";
import { DISCLAIMER_AR, DISCLAIMER_EN } from "../../shared-types/src/index.ts";
import { inspectQr } from "../../qr-tlv/src/index.ts";
import { inspectXmlFile } from "../../xml-validator/src/index.ts";
import { rulesetInfo } from "../../rulesets/src/index.ts";

export const APP_VERSION = "0.1.0-beta";

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

export interface ValidateInput {
  qrBase64?: string;
  xmlText?: string;
  xmlFileName?: string;
}

export function validateSession(input: ValidateInput): ValidationSession {
  const findings: ValidationFinding[] = [];
  const layers: LayerResult[] = [];
  let qrArt;
  let xmlArt;
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
  layers.push({ layer: "xsd", status: "NOT_CHECKED", checked: false, findings: [] });
  layers.push({ layer: "sdk", status: "NOT_CHECKED", checked: false, findings: [] });
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
