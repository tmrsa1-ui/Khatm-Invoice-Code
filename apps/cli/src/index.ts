#!/usr/bin/env node
import { readFileSync, existsSync } from "node:fs";
import { validateSession } from "../../../packages/validation-core/src/index.ts";
import { renderHtml, renderJson, projectFindings } from "../../../packages/report-engine/src/index.ts";
import { probeOfficialSdk } from "../../../packages/sdk-adapter/src/index.ts";
import { inspectSchemas, runUserXsdIfPinned } from "../../../packages/schema-runner/src/index.ts";
import { classifySdkText, diffSessions } from "../../../packages/differential/src/index.ts";

function help(): string {
  return `khatm — ختم فاتورة
فحص تقني محلي للفواتير الإلكترونية السعودية. ليست تابعة لزاتكا.
C14N11 = INCONCLUSIVE. XSD = NOT_CHECKED ما لم يوفِّر المستخدم الملفات خارج Git.
نجاح xmllint على مخطط المستخدم ليس اعتمادًا من الهيئة.

  node --experimental-strip-types apps/cli/src/index.ts qr <base64-or-file>
  node --experimental-strip-types apps/cli/src/index.ts xml <file>
  node --experimental-strip-types apps/cli/src/index.ts compare --qr <b64-or-file> --xml <file>
  node --experimental-strip-types apps/cli/src/index.ts schemas [--schema-dir DIR] [--pins FILE] [--xml FILE]
  node --experimental-strip-types apps/cli/src/index.ts sdk-status
  node --experimental-strip-types apps/cli/src/index.ts diff --xml <file> --sdk-out <log>

المخططات (خارج Git فقط):
  --schema-dir | --schemas | $KHATM_SCHEMA_DIR
  --pins                 | $KHATM_SCHEMA_PINS
`;
}

function flag(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  if (i >= 0) return process.argv[i + 1];
  return undefined;
}

function schemaDir(): string | undefined {
  return flag("--schema-dir") || flag("--schemas") || process.env.KHATM_SCHEMA_DIR;
}

function pinsPath(): string | undefined {
  return flag("--pins") || process.env.KHATM_SCHEMA_PINS;
}

function readPayload(value: string): string {
  if (existsSync(value)) return readFileSync(value, "utf8").trim();
  return value.trim();
}

function sessionOpts(extra: { qrBase64?: string; xmlText?: string; xmlFileName?: string } = {}) {
  return {
    ...extra,
    schemaDir: schemaDir(),
    pinsPath: pinsPath(),
  };
}

function emit(session: ReturnType<typeof validateSession>) {
  if (session.overall_status === "FAILED") process.exitCode = 1;
  if (process.argv.includes("--html")) {
    process.stdout.write(renderHtml(session) + "\n");
    return;
  }
  if (process.argv.includes("--json")) {
    process.stdout.write(renderJson(session) + "\n");
    return;
  }
  process.stdout.write(JSON.stringify({
    overall_status: session.overall_status,
    ruleset: session.ruleset.version,
    layers: session.layers.map((l) => ({ layer: l.layer, status: l.status, checked: l.checked })),
    findings: projectFindings(session, process.argv.includes("--technical") ? "technical" : "simple"),
    disclaimer_ar: session.disclaimer_ar,
    c14n11: "INCONCLUSIVE",
    xsd: "NOT_CHECKED unless user-supplied pinned files + xmllint; xmllint ok is not ZATCA certification",
  }, null, 2) + "\n");
}

function main() {
  const args = process.argv.slice(2);
  if (!args.length || args.includes("--help") || args[0] === "help") {
    process.stdout.write(help());
    return;
  }
  const cmd = args[0];
  if (cmd === "sdk-status") {
    process.stdout.write(JSON.stringify(probeOfficialSdk(flag("--sdk")), null, 2) + "\n");
    return;
  }
  if (cmd === "schemas") {
    const dir = schemaDir();
    const pins = pinsPath();
    const inspected = inspectSchemas(dir);
    const xmlPath = flag("--xml");
    const xsdRun = xmlPath
      ? runUserXsdIfPinned({ xmlText: readPayload(xmlPath), schemaDir: dir, pinsPath: pins })
      : undefined;
    process.stdout.write(JSON.stringify({
      ...inspected,
      xsdRun,
      note_en: "xmllint success is NOT_CHECKED — not ZATCA certification. Authority files are not vendored.",
    }, null, 2) + "\n");
    return;
  }
  if (cmd === "diff") {
    const xmlPath = flag("--xml");
    const sdkOut = flag("--sdk-out");
    if (!xmlPath) {
      process.stderr.write("diff requires --xml\n");
      process.exitCode = 1;
      return;
    }
    const local = validateSession(sessionOpts({ xmlText: readPayload(xmlPath), xmlFileName: xmlPath }));
    const sdk = classifySdkText(sdkOut && existsSync(sdkOut) ? readFileSync(sdkOut, "utf8") : "");
    process.stdout.write(JSON.stringify({ local: local.overall_status, sdk, diff: diffSessions(local, sdk) }, null, 2) + "\n");
    return;
  }
  if (cmd === "qr") {
    const raw = args[1];
    if (!raw) {
      process.stderr.write("qr requires a base64 string or file\n");
      process.exitCode = 1;
      return;
    }
    emit(validateSession(sessionOpts({ qrBase64: readPayload(raw) })));
    return;
  }
  if (cmd === "xml") {
    const raw = args[1];
    if (!raw) {
      process.stderr.write("xml requires a file path or XML string\n");
      process.exitCode = 1;
      return;
    }
    emit(validateSession(sessionOpts({ xmlText: readPayload(raw), xmlFileName: raw })));
    return;
  }
  if (cmd === "compare") {
    const qr = flag("--qr");
    const xml = flag("--xml");
    if (!qr || !xml) {
      process.stderr.write("compare requires --qr and --xml\n");
      process.exitCode = 1;
      return;
    }
    emit(validateSession(sessionOpts({
      qrBase64: readPayload(qr),
      xmlText: readPayload(xml),
      xmlFileName: xml,
    })));
    return;
  }
  process.stdout.write(help());
  process.exitCode = 1;
}

main();
