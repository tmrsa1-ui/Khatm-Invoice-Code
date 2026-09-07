import type { ResultStatus, ValidationFinding } from "../../shared-types/src/index.ts";

export function probeOfficialSdk(_path?: string): { status: ResultStatus; used: boolean; findings: ValidationFinding[] } {
  return {
    status: "NOT_CHECKED",
    used: false,
    findings: [{
      id: "SDK-NOT-BUNDLED",
      layer: "sdk",
      severity: "info",
      category: "sdk",
      status: "NOT_CHECKED",
      title_ar: "SDK زاتكا غير مضمّن",
      title_en: "ZATCA SDK is not bundled",
      message_ar: "الأداة لا توزع SDK. النتيجة ليست اعتمادًا.",
      message_en: "The tool does not ship the SDK. This is not an approval.",
      source: { document: "Khatm policy", rule_reference: "no-vendor-sdk", url: "https://zatca.gov.sa", ruleset_version: "2023-05-19" },
      evidence: {},
      suggested_action_ar: "ثبّت SDK محليًا إن أردت مقارنة تفاضلية.",
      suggested_action_en: "Install the SDK locally only if you want a differential compare.",
      auto_fix_available: false,
    }],
  };
}
