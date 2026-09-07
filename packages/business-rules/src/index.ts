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

function firstAmount(text: string, localName: string, fallback?: string | null): number | null {
  const re = new RegExp(`<(?:[\\w]+:)?${localName}[^>]*>([^<]+)`);
  return money(text.match(re)?.[1] ?? fallback);
}

function finding(
  partial: Partial<ValidationFinding> & Pick<ValidationFinding, "id" | "status" | "title_ar" | "title_en" | "message_ar" | "message_en">,
  evidence: Record<string, unknown>,
): ValidationFinding {
  return {
    layer: "business",
    severity: partial.status === "FAILED" ? "error" : "info",
    category: "totals",
    source: SOURCE,
    evidence,
    suggested_action_ar: "راجع مجاميع المصدر.",
    suggested_action_en: "Review source totals.",
    auto_fix_available: false,
    ...partial,
  };
}

export function inspectBusiness(input: {
  xmlText?: string;
  xml?: XMLArtifact;
  qr?: { fields?: Array<{ tag: number; textValue?: string | null }> };
}): { findings: ValidationFinding[]; status: ResultStatus } {
  const text = input.xmlText ?? "";
  if (!text.trim()) {
    return { status: "NOT_APPLICABLE", findings: [] };
  }
  const tax = firstAmount(text, "TaxAmount", input.xml?.taxAmount);
  const incl = firstAmount(text, "TaxInclusiveAmount", input.xml?.taxInclusiveAmount);
  const excl = firstAmount(text, "TaxExclusiveAmount");
  const payable = firstAmount(text, "PayableAmount", input.xml?.payableAmount);
  const prepaid = firstAmount(text, "PrepaidAmount") ?? 0;
  const evidence = { tax, incl, excl, payable, prepaid };

  if ((tax != null && tax < 0) || (incl != null && incl < 0) || (excl != null && excl < 0) || (payable != null && payable < 0)) {
    return {
      status: "FAILED",
      findings: [finding({
        id: "KHTM-CALC-NEGATIVE",
        status: "FAILED",
        title_ar: "قيمة سالبة في المجاميع",
        title_en: "Negative total",
        message_ar: "مبلغ سالب لا يُقبل في الفحص المحلي.",
        message_en: "A negative amount fails the local arithmetic check.",
      }, evidence)],
    };
  }

  if (incl != null && payable != null && Math.abs(incl - prepaid - payable) >= 0.02) {
    return {
      status: "FAILED",
      findings: [finding({
        id: "KHTM-PAYABLE-MISMATCH",
        status: "FAILED",
        title_ar: "المبلغ المستحق لا يطابق الشامل بعد الدفعات المقدمة",
        title_en: "Payable does not match inclusive minus prepaid",
        message_ar: "PayableAmount يجب أن يساوي TaxInclusiveAmount ناقص PrepaidAmount ضمن 0.02.",
        message_en: "PayableAmount must equal TaxInclusiveAmount minus PrepaidAmount within 0.02.",
      }, evidence)],
    };
  }

  if (tax != null && incl != null && excl != null) {
    if (Math.abs(excl + tax - incl) >= 0.02) {
      return {
        status: "FAILED",
        findings: [finding({
          id: "KHTM-TOTALS-MISMATCH",
          status: "FAILED",
          title_ar: "المجاميع غير متسقة",
          title_en: "Totals are inconsistent",
          message_ar: "TaxExclusive + Tax لا يساوي TaxInclusive ضمن هامش 0.02.",
          message_en: "TaxExclusive + Tax does not equal TaxInclusive within 0.02.",
        }, evidence)],
      };
    }
    return {
      status: "PASS_LOCAL_RULES",
      findings: [finding({
        id: "KHTM-TOTALS-OK",
        status: "PASS_LOCAL_RULES",
        title_ar: "المجاميع المحلية متسقة",
        title_en: "Local totals are consistent",
        message_ar: "فحص حسابي محلي وليس اعتمادًا من الهيئة.",
        message_en: "Local arithmetic only. Not an Authority approval.",
      }, evidence)],
    };
  }

  return {
    status: "NOT_CHECKED",
    findings: [finding({
      id: "KHTM-CALC-INCOMPLETE",
      status: "NOT_CHECKED",
      title_ar: "لم تكتمل مجاميع الضريبة للمقارنة",
      title_en: "Tax totals are incomplete for arithmetic",
      message_ar: "يلزم TaxExclusive وTax وTaxInclusive معًا.",
      message_en: "TaxExclusive, Tax, and TaxInclusive are all required.",
      suggested_action_ar: "أضف المجاميع الثلاثة إن وُجدت في المصدر.",
      suggested_action_en: "Supply the three totals if they exist in the source.",
    }, evidence)],
  };
}
