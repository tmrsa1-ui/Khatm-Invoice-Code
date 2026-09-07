import type { ResultStatus, ValidationFinding } from "../../shared-types/src/index.ts";

export function inspectSchemas(_dir?: string): { status: ResultStatus; findings: ValidationFinding[] } {
  return {
    status: "NOT_CHECKED",
    findings: [{
      id: "XSD-NOT-BUNDLED",
      layer: "xsd",
      severity: "info",
      category: "schema",
      status: "NOT_CHECKED",
      title_ar: "XSD غير مضمّن",
      title_en: "XSD is not bundled",
      message_ar: "الملفات الرسمية غير موجودة في Git.",
      message_en: "Official schema files are not in Git.",
      source: { document: "Khatm policy", rule_reference: "no-vendor-xsd", url: "https://zatca.gov.sa", ruleset_version: "2023-05-19" },
      evidence: {},
      suggested_action_ar: "ثبّت المخططات محليًا بعد قبول الشروط.",
      suggested_action_en: "Retrieve schemas locally after accepting Authority terms.",
      auto_fix_available: false,
    }],
  };
}
