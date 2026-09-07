/**
 * ZATCA FATOORA QR: Base64( TLV* )
 * Tag: 1 byte. Length: 1 byte = UTF-8 byte count, not characters.
 */
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
  rule_reference: "QR payload size / tags 1–9",
  url: "https://zatca.gov.sa/ar/E-Invoicing/SystemsDevelopers/Documents/20230519_ZATCA_Electronic_Invoice_Security_Features_Implementation_Standards_vF.pdf",
  ruleset_version: "2023-05-19",
  published_date: "2023-05-19",
};

export const TAG_NAMES: Record<number, string> = {
  1: "seller_name",
  2: "vat_number",
  3: "timestamp",
  4: "invoice_total",
  5: "vat_amount",
  6: "invoice_hash",
  7: "ecdsa_signature",
  8: "ecdsa_public_key",
  9: "cryptographic_stamp",
};

export function decodeBase64Flexible(input: string): { ok: true; bytes: Uint8Array } | { ok: false; error: string } {
  const trimmed = input.trim().replace(/\s+/g, "");
  if (!trimmed) return { ok: false, error: "empty" };
  if (/^https?:\/\//i.test(trimmed) || trimmed.includes("://")) return { ok: false, error: "url-payload" };
  if (!/^[A-Za-z0-9+/]+=*$/.test(trimmed)) return { ok: false, error: "invalid-base64" };
  try {
    const buf = Buffer.from(trimmed, "base64");
    if (buf.length === 0 && trimmed.length > 0) return { ok: false, error: "invalid-base64" };
    return { ok: true, bytes: new Uint8Array(buf) };
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
    fields.push({ tag, length, rawBytes, rawHex, textValue });
    i += length;
  }
  const seen = new Map<number, number>();
  for (const f of fields) seen.set(f.tag, (seen.get(f.tag) ?? 0) + 1);
  for (const [tag, n] of seen) if (n > 1) errors.push(`duplicate-tag-${tag}`);
  return { fields, errors };
}

export function parseQr(rawBase64: string): QRArtifact {
  const decoded = decodeBase64Flexible(rawBase64);
  if (!decoded.ok) return { rawBase64: rawBase64.trim(), byteLength: 0, fields: [], errors: [decoded.error] };
  const { fields, errors } = parseTlv(decoded.bytes);
  return { rawBase64: rawBase64.trim().replace(/\s+/g, ""), byteLength: decoded.bytes.length, fields, errors };
}

export const decodeQrBase64 = parseQr;

export function inspectQr(rawBase64: string): { artifact: QRArtifact; findings: ValidationFinding[]; status: ResultStatus } {
  const max = rulesetInfo().qr_base64_max;
  const compact = rawBase64.trim().replace(/\s+/g, "");
  const findings: ValidationFinding[] = [];
  const artifact = parseQr(compact);
  if (compact.length > max) {
    findings.push(f({ id: "QR-BASE64-OVERSIZE", severity: "error", status: "FAILED", title_ar: "حمولة الرمز أطول من الحد النشط", title_en: "QR payload exceeds the active length cap", message_ar: `الطول ${compact.length} يتجاوز ${max}.`, message_en: `Length ${compact.length} exceeds ${max}.`, source: SEC_SOURCE, evidence: { actual_value: compact.length } }));
  }
  if (artifact.errors.includes("url-payload") || artifact.errors.includes("invalid-base64") || artifact.errors.includes("empty") || artifact.errors.some((e) => e.startsWith("truncated"))) {
    findings.push(f({ id: "QR-INVALID", severity: "error", status: "FAILED", title_ar: "رمز غير صالح", title_en: "QR is not valid TLV/Base64", message_ar: artifact.errors.join(","), message_en: artifact.errors.join(","), source: QR_SOURCE, evidence: {} }));
    return { artifact, findings, status: "FAILED" };
  }
  const tags = artifact.fields.map((x) => x.tag);
  for (const required of [1, 2, 3, 4, 5]) {
    if (!tags.includes(required)) {
      findings.push(f({ id: `QR-MISSING-TAG-${required}`, severity: "error", status: "FAILED", title_ar: `الوسم ${required} مفقود`, title_en: `Tag ${required} is missing`, message_ar: TAG_NAMES[required] ?? String(required), message_en: TAG_NAMES[required] ?? String(required), source: QR_SOURCE, evidence: { tag: required } }));
    }
  }
  const failed = findings.some((x) => x.status === "FAILED");
  if (!failed && artifact.fields.length) {
    findings.push(f({ id: "QR-TLV-OK", severity: "info", status: "PASS_LOCAL_RULES", title_ar: "بنية TLV المحلية مقبولة", title_en: "Local TLV structure is acceptable", message_ar: "فحص بنيوي محلي وليس اعتمادًا.", message_en: "Local structural check, not an approval.", source: QR_SOURCE, evidence: { tags: tags.join(",") } }));
  }
  return { artifact, findings, status: failed ? "FAILED" : artifact.fields.length ? "PASS_LOCAL_RULES" : "FAILED" };
}

function f(partial: Omit<ValidationFinding, "auto_fix_available" | "layer" | "category" | "suggested_action_ar" | "suggested_action_en">): ValidationFinding {
  return { ...partial, layer: "qr", category: "qr", auto_fix_available: false, suggested_action_ar: "راجع توليد الرمز مقابل دليل QR.", suggested_action_en: "Review QR generation against the cited guide." };
}

export const OFFICIAL_BOBS_RECORDS_B64 = "AQxCb2JzIFJlY29yZHMCDzMxMDEyMjM5MzUwMDAwMwMUMjAyMi0wNC0yNVQxNTozMDowMFoEBzEwMDAuMDAFBjE1MC4wMA==";
