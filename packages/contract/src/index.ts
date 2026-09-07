export const CONTRACT_VERSION = "v1";
export type { ValidationSession, ResultStatus, ValidationFinding } from "../../shared-types/src/index.ts";

export const RESULT_STATUSES = [
  "PASS_LOCAL_RULES",
  "PASS_OFFICIAL_SDK",
  "FAILED",
  "WARNING",
  "INCONCLUSIVE",
  "NOT_CHECKED",
  "NOT_APPLICABLE",
  "UNSUPPORTED_RULESET",
] as const;

export const FORBIDDEN_CLAIM_RE = /معتمدة|اعتماد رسمي|approved by ZATCA|ZATCA-approved/i;

export interface ContractIssue {
  path: string;
  message: string;
}

export function assertSession(session: unknown): ContractIssue[] {
  const issues: ContractIssue[] = [];
  if (!session || typeof session !== "object") {
    return [{ path: "$", message: "session-not-object" }];
  }
  const s = session as Record<string, unknown>;
  if (!s.overall_status) issues.push({ path: "overall_status", message: "missing" });
  else if (!RESULT_STATUSES.includes(s.overall_status as (typeof RESULT_STATUSES)[number])) {
    issues.push({ path: "overall_status", message: "unknown-status" });
  }
  if (!Array.isArray(s.findings)) issues.push({ path: "findings", message: "missing" });
  if (!Array.isArray(s.layers)) issues.push({ path: "layers", message: "missing" });
  if (s.ruleset == null) issues.push({ path: "ruleset", message: "missing" });
  if (typeof s.disclaimer_ar !== "string") issues.push({ path: "disclaimer_ar", message: "missing" });
  if (typeof s.disclaimer_en !== "string") issues.push({ path: "disclaimer_en", message: "missing" });
  const blob = `${s.disclaimer_ar ?? ""} ${s.disclaimer_en ?? ""}`;
  if (FORBIDDEN_CLAIM_RE.test(blob)) issues.push({ path: "disclaimer", message: "forbidden-claim" });
  return issues;
}

export function isSession(session: unknown): boolean {
  return assertSession(session).length === 0;
}

export function assertSessionShape(session: unknown): void {
  const issues = assertSession(session);
  if (issues.length) throw new Error(issues.map((i) => i.path).join(","));
}

export function sessionToContractJson(session: unknown): string {
  assertSessionShape(session);
  return JSON.stringify(session);
}
