import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const FORBIDDEN = [/معتمدة/u, /approved by ZATCA/i, /شهادة اعتماد/u];
const BAN = /forbidden|حظر|must not|لا يجوز|Banned|FORBIDDEN|ليست|not an approval|is not ZATCA|ليس اعتماد|never|do not claim|ليس اعتمادًا|not affiliated|fail the contract/i;

function walk(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, name.name);
    if (name.isDirectory()) walk(p, acc);
    else if (/\.(html|js|md|ts)$/.test(name.name)) acc.push(p);
  }
  return acc;
}

test("A7 product surfaces do not claim ZATCA approval", () => {
  const files = [...walk("apps/web"), ...walk("packages"), "README.md", "README.ar.md", "PRIVACY.md"];
  const hits: string[] = [];
  for (const file of files) {
    let text = "";
    try { text = readFileSync(file, "utf8"); } catch { continue; }
    for (const re of FORBIDDEN) {
      if (re.test(text) && !BAN.test(text)) hits.push(file);
    }
  }
  assert.deepEqual(hits, []);
});
