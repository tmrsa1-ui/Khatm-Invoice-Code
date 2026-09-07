import type { ResultStatus, ValidationFinding } from "../../shared-types/src/index.ts";

const SOURCE = {
  document: "ZATCA Electronic Invoice Security Features Implementation Standards v1.2",
  rule_reference: "Cryptographic stamp / C14N11 — not implemented",
  url: "https://zatca.gov.sa/ar/E-Invoicing/SystemsDevelopers/Documents/20230519_ZATCA_Electronic_Invoice_Security_Features_Implementation_Standards_vF.pdf",
  ruleset_version: "2023-05-19",
  published_date: "2023-05-19",
};

export function inspectCrypto(_input?: unknown): { findings: ValidationFinding[]; status: ResultStatus } {
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
      message_ar: "لا يُحسم التوقيع محليًا في هذه النسخة.",
      message_en: "Signatures are not decided locally in this build.",
      source: SOURCE,
      evidence: { implemented: false },
      suggested_action_ar: "استخدم SDK المستخدم للمقارنة التفاضلية.",
      suggested_action_en: "Use a user-installed SDK for differential compare.",
      auto_fix_available: false,
    }],
  };
}
