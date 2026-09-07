import type { QRArtifact, ResultStatus, TlvField, ValidationFinding } from "../../shared-types/src/index.ts";
import { rulesetInfo } from "../../rulesets/src/index.ts";

const QR_SOURCE = {
  document: "ZATCA Guide to Developed FATOORA Compliant QR Code",
  rule_reference: "TLV + Base64",
  url: "https://zatca.gov.sa/en/E-Invoicing/SystemsDevelopers/Documents/QRCodeCreation.pdf",
  ruleset_version: "2021-11-18",
  published_date: "2021-11-18",
};

export const TAG_NAMES: Record<number, string> = {
  1: "seller_name", 2: "vat_number", 3: "timestamp", 4: "invoice_total", 5: "vat_amount",
  6: "invoice_hash", 7: "ecdsa_signature", 8: "ecdsa_public_key", 9: "cryptographic_stamp",
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
  return { rawBase64: rawBase64.trim().replace(/\s+/g, ""), byteLength: decoded.bytes.length, fields, errors };
}

export const decodeQrBase64 = parseQr;

export function inspectQr(rawBase64: string): { artifact: QRArtifact; findings: ValidationFinding[]; status: ResultStatus } {
  const compact = rawBase64.trim().replace(/\s+/g, "");
  const findings: ValidationFinding[] = [];
  const artifact = parseQr(compact);
  const failed = artifact.errors.length > 0;
  if (failed) {
    findings.push({ id: "QR-INVALID", layer: "qr", severity: "error", category: "qr", status: "FAILED", title_ar: "رمز غير صالح", title_en: "QR is not valid", message_ar: artifact.errors.join(","), message_en: artifact.errors.join(","), source: QR_SOURCE, evidence: {}, suggested_action_ar: "راجع الرمز.", suggested_action_en: "Review the QR.", auto_fix_available: false });
    return { artifact, findings, status: "FAILED" };
  }
  findings.push({ id: "QR-TLV-OK", layer: "qr", severity: "info", category: "qr", status: "PASS_LOCAL_RULES", title_ar: "بنية TLV مقبولة", title_en: "Local TLV acceptable", message_ar: "فحص بنيوي محلي وليس اعتمادًا.", message_en: "Local structural check, not an approval.", source: QR_SOURCE, evidence: {}, suggested_action_ar: "—", suggested_action_en: "—", auto_fix_available: false });
  return { artifact, findings, status: "PASS_LOCAL_RULES" };
}

export const OFFICIAL_BOBS_RECORDS_B64 = "AQxCb2JzIFJlY29yZHMCDzMxMDEyMjM5MzUwMDAwMwMUMjAyMi0wNC0yNVQxNTozMDowMFoEBzEwMDAuMDAFBjE1MC4wMA==";
