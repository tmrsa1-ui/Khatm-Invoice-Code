import type { ResultStatus, ValidationFinding, XMLArtifact } from "../../shared-types/src/index.ts";

const SOURCE = {
  document: "ZATCA Electronic Invoice XML Implementation Standard v1.2",
  rule_reference: "Document totals / tax amount consistency (local arithmetic)",
  url: "https://zatca.gov.sa/ar/E-Invoicing/SystemsDevelopers/Documents/20230519_ZATCA_Electronic_Invoice_XML_Implementation_Standard_%20vF.pdf",
  ruleset_version: "2023-05-19",
  published_date: "2023-05-19",
};

function money(v?: string | null): number | null {
  if (v == null || v === "") return null;
  const n = Number(String(v).replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

export function inspectBusiness(input: { xmlText?: string; xml?: XMLArtifact; qr?: { fields?: Array<{ tag: number; textValue?: string | null }> } }): { findings: ValidationFinding[]; status: ResultStatus } {
  const text = input.xmlText ?? "";
  if (!text.trim()) {
    return { status: "NOT_APPLICABLE", findings: [] };
  }
  const tax = money(text.match(/<(?:[\w]+:)?TaxAmount[^>]*>([^<]+)/)?.[1] ?? input.xml?.taxAmount);
  const incl = money(text.match(/<(?:[\w]+:)?TaxInclusiveAmount[^>]*>([^<]+)/)?.[1]);
  const excl = money(text.match(/<(?:[\w]+:)?TaxExclusiveAmount[^>]*>([^<]+)/)?.[1]);
  if (tax != null && incl != null && excl != null && Math.abs(excl + tax - incl) >= 0.02) {
    return {
      status: "FAILED",
      findings: [{
        id: "KHTM-TOTALS-MISMATCH",
        layer: "business",
        severity: "error",
        category: "totals",
        status: "FAILED",
        title_ar: "المجاميع غير متسقة",
        title_en: "Totals are inconsistent",
        message_ar: "TaxExclusive + Tax لا يساوي TaxInclusive ضمن حامش 0.02.",
        message_en: "TaxExclusive + Tax does not equal TaxInclusive within 0.02.",
        source: SOURCE,
        evidence: { tax, incl, excl },
        suggested_action_ar: "راجع مجاميع المصدر.",
        suggested_action_en: "Review source totals.",
        auto_fix_available: false,
      }],
    };
  }
  return { status: "PASS_LOCAL_RULES", findings: [] };
}
