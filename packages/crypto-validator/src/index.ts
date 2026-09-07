import type { ResultStatus, ValidationFinding } from "../../shared-types/src/index.ts";

const SOURCE = {
  document: "ZATCA Electronic Invoice Security Features Implementation Standards v1.2",
  rule_reference: "Cryptographic stamp / C14N11 — not implemented",
  url: "https://zatca.gov.sa/ar/E-Invoicing/SystemsDevelopers/Documents/20230519_ZATCA_Electronic_Invoice_Security_Features_Implementation_Standards_vF.pdf",
  ruleset_version: "2023-05-19",
  published_date: "2023-05-19",
};

export function computeInvoiceHash(_xmlText?: string): {
  status: ResultStatus;
  algorithm: "SHA-256";
  canonicalization: "xml-c14n11";
  implemented: false;
  reason_ar: string;
  reason_en: string;
} {
  return {
    status: "INCONCLUSIVE",
    algorithm: "SHA-256",
    canonicalization: "xml-c14n11",
    implemented: false,
    reason_ar:
      "تجزئة الفاتورة تتطلب إزالة عناصر محددة ثم C14N11 وفق المواصفات الأمنية. التحويل غير مكتمل؛ تجزئة النص الخام ليست بديلًا صالحًا للحكم.",
    reason_en:
      "Invoice hash requires removing specified elements then C14N11 per the security standard. The transform is incomplete; a raw-text SHA-256 is not a valid verdict.",
  };
}

export function inspectCrypto(_input?: unknown): { findings: ValidationFinding[]; status: ResultStatus } {
  const hashed = computeInvoiceHash();
  return {
    status: "INCONCLUSIVE",
    findings: [{
      id: "CRYPTO-C14N-INCONCLUSIVE",
      layer: "crypto",
      severity: "info",
      category: "crypto",
      status: "INCONCLUSIVE",
      title_ar: "التجزئة وC14N غير مكتملة",
      title_en: "Hash and C14N are not complete",
      message_ar: hashed.reason_ar,
      message_en: hashed.reason_en,
      source: SOURCE,
      evidence: { implemented: false, canonicalization: "xml-c14n11" },
      suggested_action_ar: "لا تعرض «التجزئة صحيحة». أبقِ الحالة غير حاسمة حتى تثبت الاختبارات التحويل الرسمي.",
      suggested_action_en: "Do not display \u201chash valid\u201d. Keep INCONCLUSIVE until fixtures prove the official transform.",
      auto_fix_available: false,
    }],
  };
}
