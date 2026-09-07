import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { RulesetInfo } from "../../shared-types/src/index.ts";

export const ACTIVE_RULESET_ID = "zatca-2023-05-19";

export function loadActiveRuleset(): RulesetInfo & Record<string, unknown> {
  const dir = dirname(fileURLToPath(import.meta.url));
  const raw = readFileSync(join(dir, "zatca-2023-05-19.json"), "utf8");
  return JSON.parse(raw);
}

export function rulesetInfo(): RulesetInfo {
  const r = loadActiveRuleset();
  return {
    id: r.id,
    version: r.version,
    published_date: r.published_date,
    qr_base64_max: r.qr_base64_max,
  };
}

export const ACTIVE_RULESET = rulesetInfo();
export const ACTIVE_RULESET_SOURCES = loadActiveRuleset();
