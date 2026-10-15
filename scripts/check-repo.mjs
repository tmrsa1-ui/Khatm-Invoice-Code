// فحص سريع لسلامة المستودع: ملفات أساسية، JSON صالح، لا أسرار ولا ملفات .env متتبعة.
import { execSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";

const problems = [];
const tracked = execSync("git ls-files", { encoding: "utf8" }).split("\n").filter(Boolean);

for (const f of ["README.md", "LICENSE", "PRIVACY.md", "package.json"]) {
  if (!existsSync(f)) problems.push(`missing required file: ${f}`);
}

for (const f of tracked.filter((f) => /(^|\/)\.env($|\.(?!example$))/.test(f))) {
  problems.push(`tracked env file: ${f}`);
}

for (const f of tracked.filter((f) => f.endsWith(".json") || f.endsWith(".webmanifest"))) {
  try { JSON.parse(readFileSync(f, "utf8")); } catch (e) { problems.push(`invalid JSON: ${f} (${e.message})`); }
}

const secret = /(sk-ant-[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{35}|-----BEGIN (RSA |EC )?PRIVATE KEY)/;
for (const f of tracked.filter((f) => /\.(ts|js|mjs|json|html|md|toml|ya?ml)$/.test(f))) {
  const text = readFileSync(f, "utf8");
  if (secret.test(text)) problems.push(`possible secret in ${f}`);
}

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
for (const [name, cmd] of Object.entries(pkg.scripts ?? {})) {
  for (const m of cmd.matchAll(/(?:node|bash)\s+(?:--\S+\s+)*([\w./-]+\.(?:mjs|js|ts|sh))\b/g)) {
    if (!existsSync(m[1])) problems.push(`script "${name}" points to missing file ${m[1]}`);
  }
}

if (problems.length) {
  console.error(problems.map((p) => `✗ ${p}`).join("\n"));
  process.exit(1);
}
console.log(`✓ repo check passed (${tracked.length} tracked files)`);
