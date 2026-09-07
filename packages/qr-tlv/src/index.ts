import type { QRArtifact, ResultStatus, TlvField, ValidationFinding } from "../../shared-types/src/index.ts";
import { rulesetInfo } from "../../rulesets/src/index.ts";

const QR_SOURCE = {
  document: "ZATCA Guide to Developed FATOORA Compliant QR Code",
  rule_reference: "TLV + Base64",
  url: "https://zatca.gov.sa/en/E-Invoicing/SystemsDevelopers/Documents/QRCodeCreation.pdf",
  ruleset_version: "2021-11-18",
  published_date: "2021-11-18",
};

const SEC_SOURCE = {
  document: "ZATCA Electronic Invoice Security Features Implementation Standards v1.2",
  rule_reference: "QR payload size / tags 1–5",
  url: "https://zatca.gov.sa/ar/E-Invoicing/SystemsDevelopers/Documents/20230519_ZATCA_Electronic_Invoice_Security_Features_Implementation_Standards_vF.pdf",
  ruleset_version: "2023-05-19",
  published_date: "2023-05-19",
};

export const TAG_NAMES: Record<number, string> = {
  1: "seller_name", 2: "vat_number", 3: "timestamp", 4: "invoice_total", 5: "vat_amount",
  6: "invoice_hash", 7: "ecdsa_signature", 8: "ecdsa_public_key", 9: "cryptographic_stamp",
};

function qrFinding(
  partial: Partial<ValidationFinding> & Pick<ValidationFinding, "id" | "status" | "title_ar" | "title_en">,
): ValidationFinding {
  return {
    layer: "qr",
    severity: partial.status === "FAILED" ? "error" : "info",
    category: "qr",
    message_ar: "",
    message_en: "",
    source: QR_SOURCE,
    evidence: {},
    suggested_action_ar: "",
    suggested_action_en: "",
    auto_fix_available: false,
    ...partial,
  };
}

export function decodeBase64Flexible(input: string): { ok: true; bytes: Uint8Array; compact: string } | { ok: false; error: string } {
  const trimmed = input.trim().replace(/\s+/g, "");
  if (!trimmed) return { ok: false, error: "empty" };
  if (/^https?:\/\//i.test(trimmed) || trimmed.includes("://")) return { ok: false, error: "url-payload" };
  if (!/^[A-Za-z0-9+/]+=*$/.test(trimmed)) return { ok: false, error: "invalid-base64" };
  try {
    const buf = Buffer.from(trimmed, "base64");
    if (buf.length === 0 && trimmed.replace(/=/g, "").length > 0) return { ok: false, error: "invalid-base64" };
    return { ok: true, bytes: new Uint8Array(buf), compact: trimmed };
  } catch {
    return { ok: false, error: "invalid-base64" };
  }
}

export function parseTlv(bytes: Uint8Array): { fields: TlvField[]; errors: string[] } {
  const fields: TlvField[] = [];
  const errors: string[] = [];
  let i = 0;
  while (i < bytes.length) {
    if (i + 2 > bytes.length) { errors.push("truncated-header"); break; }
    const tag = bytes[i];
    const length = bytes[i + 1];
    i += 2;
    if (i + length > bytes.length) { errors.push("truncated-value"); break; }
    const rawBytes = Array.from(bytes.slice(i, i + length));
    const rawHex = rawBytes.map((b) => b.toString(16).padStart(2, "0")).join("");
    let textValue: string | null = null;
    try { textValue = Buffer.from(rawBytes).toString("utf8"); } catch { textValue = null; }
    fields.push({ tag, length, rawBytes, rawHex, textValue, name_en: TAG_NAMES[tag] || ("tag_" + tag) });
    i += length;
  }
  return { fields, errors };
}

export function encodeTlv(fields: Array<{ tag: number; value: string | Uint8Array }>): Uint8Array {
  const chunks: number[] = [];
  for (const f of fields) {
    const bytes = typeof f.value === "string" ? Array.from(Buffer.from(f.value, "utf8")) : Array.from(f.value);
    chunks.push(f.tag & 0xff, bytes.length, ...bytes);
  }
  return Uint8Array.from(chunks);
}

export function encodeQrBase64(fields: Array<{ tag: number; value: string | Uint8Array }>): string {
  return Buffer.from(encodeTlv(fields)).toString("base64");
}

export function parseQr(rawBase64: string): QRArtifact {
  const decoded = decodeBase64Flexible(rawBase64);
  if (!decoded.ok) return { rawBase64: rawBase64.trim(), byteLength: 0, fields: [], errors: [decoded.error] };
  const { fields, errors } = parseTlv(decoded.bytes);
  return { rawBase64: decoded.compact, byteLength: decoded.bytes.length, fields, errors };
}

export const decodeQrBase64 = parseQr;

export function inspectQr(rawBase64: string): { artifact: QRArtifact; findings: ValidationFinding[]; status: ResultStatus } {
  const compact = rawBase64.trim().replace(/\s+/g, "");
  const findings: ValidationFinding[] = [];
  const decoded = decodeBase64Flexible(compact);
  if (!decoded.ok) {
    const artifact: QRArtifact = { rawBase64: compact, byteLength: 0, fields: [], errors: [decoded.error] };
    findings.push(qrFinding({
      id: decoded.error === "url-payload" ? "QR-URL-PAYLOAD" : "QR-INVALID-BASE64",
      status: "FAILED",
      title_ar: "الرمز غير صالح",
      title_en: "QR is invalid",
      message_ar: decoded.error,
      message_en: decoded.error,
    }));
    return { artifact, findings, status: "FAILED" };
  }
  const artifact = parseQr(compact);
  const max = rulesetInfo().qr_base64_max;
  if (compact.length > max) {
    findings.push(qrFinding({
      id: "QR-BASE64-OVERSIZE",
      status: "FAILED",
      title_ar: "الحمولة أطول من الحد",
      title_en: "QR payload exceeds cap",
      source: SEC_SOURCE,
      evidence: { actual_value: compact.length, expected_value: max },
    }));
  }
  if (artifact.errors.length) {
    findings.push(qrFinding({
      id: "QR-TLV-TRUNCATED",
      status: "FAILED",
      title_ar: "TLV ناقص",
      title_en: "TLV truncated",
      message_ar: artifact.errors.join(","),
      message_en: artifact.errors.join(","),
    }));
    return { artifact, findings, status: "FAILED" };
  }
  const tags = artifact.fields.map((f) => f.tag);
  for (const req of [1, 2, 3, 4, 5]) {
    if (!tags.includes(req)) {
      findings.push(qrFinding({
        id: "QR-MISSING-TAG-" + req,
        status: "FAILED",
        title_ar: "الوسم " + req + " مفقود",
        title_en: "Required tag " + req + " is missing",
        source: SEC_SOURCE,
      }));
    }
  }
  const vat = artifact.fields.find((f) => f.tag === 2)?.textValue?.trim();
  if (vat && !/^[3]\d{14}$/.test(vat)) {
    findings.push(qrFinding({
      id: "QR-VAT-FORMAT",
      status: "FAILED",
      title_ar: "رقم الضريبة لا يطابق الصيغة المحلية المتوقعة",
      title_en: "VAT number does not match the expected local format",
      message_ar: "متوقع 15 رقمًا يبدأ بـ 3.",
      message_en: "Expected 15 digits starting with 3.",
      evidence: { actual_value: vat },
    }));
  }
  const ts = artifact.fields.find((f) => f.tag === 3)?.textValue?.trim();
  if (ts && Number.isNaN(Date.parse(ts))) {
    findings.push(qrFinding({
      id: "QR-TIMESTAMP-UNPARSABLE",
      status: "FAILED",
      title_ar: "الطابع الزمني غير قابل للتحليل",
      title_en: "Timestamp is not parseable",
      evidence: { actual_value: ts },
    }));
  }
  const failed = findings.some((f) => f.status === "FAILED");
  if (!failed) {
    findings.push(qrFinding({
      id: "QR-TLV-OK",
      status: "PASS_LOCAL_RULES",
      title_ar: "بنية TLV المحلية مقبولة",
      title_en: "Local TLV acceptable",
      message_ar: "فحص بنيوي محلي وليس اعتمادًا.",
      message_en: "Local structural check, not an approval.",
    }));
  }
  return { artifact, findings, status: failed ? "FAILED" : "PASS_LOCAL_RULES" };
}

export const OFFICIAL_BOBS_RECORDS_B64 = "AQxCb2JzIFJlY29yZHMCDzMxMDEyMjM5MzUwMDAwMwMUMjAyMi0wNC0yNVQxNTozMDowMFoEBzEwMDAuMDAFBjE1MC4wMA==";
