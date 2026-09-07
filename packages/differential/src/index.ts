import type { ResultStatus, ValidationSession } from "../../shared-types/src/index.ts";

export interface SdkRunSummary { status: ResultStatus; ruleIds: string[]; raw?: string; }
export interface DiffRow { id: string; kind: string; localStatus?: ResultStatus; sdkStatus?: ResultStatus; notes_ar: string; notes_en: string; }

export function classifySdkText(raw: string): SdkRunSummary {
  const text = raw ?? "";
  const lower = text.toLowerCase();
  let status: ResultStatus = "INCONCLUSIVE";
  if (!text.trim()) status = "NOT_CHECKED";
  else if (/error|failed|invalid/.test(lower)) status = "FAILED";
  else if (/valid|success|passed/.test(lower)) status = "PASS_OFFICIAL_SDK";
  return { status, ruleIds: [], raw: text.slice(0, 2000) };
}

export function diffSessions(local: ValidationSession, sdk: SdkRunSummary): DiffRow[] {
  if (sdk.status === "NOT_CHECKED") {
    return [{ id: "DIFF-SDK-ABSENT", kind: "local-cannot-check", localStatus: local.overall_status, sdkStatus: "NOT_CHECKED", notes_ar: "لم يُشغَّل SDK.", notes_en: "SDK was not run." }];
  }
  return [{ id: "DIFF-COMPARED", kind: "interpretation-diff", localStatus: local.overall_status, sdkStatus: sdk.status, notes_ar: "مقارنة غير حاسمة بدون SDK محلي.", notes_en: "Comparison is not conclusive without a local SDK." }];
}
