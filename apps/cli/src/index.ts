#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { validateSession } from "../../../packages/validation-core/src/index.ts";
import { renderHtml, renderJson, renderPdf, projectFindings } from "../../../packages/report-engine/src/index.ts";
import { probeOfficialSdk } from "../../../packages/sdk-adapter/src/index.ts";
import { inspectSchemas } from "../../../packages/schema-runner/src/index.ts";
import { classifySdkText, diffSessions } from "../../../packages/differential/src/index.ts";

function help(): string {
  return `khatm — ختم فاتورة
فحص تقني محلي للفواتير الإلكترونية السعودية. ليست تابعة لزاتكا.

  node --experimental-strip-types apps/cli/src/index.ts qr <base64-or-file>
  node --experimental-strip-types apps/cli/src/index.ts xml <file>
  node --experimental-strip-types apps/cli/src/index.ts compare --qr <b64-or-file> --xml <file>
  node --experimental-strip-types apps/cli/src/index.ts schemas
  node --experimental-strip-types apps/cli/src/index.ts sdk-status
  node --experimental-strip-types apps/cli/src/index.ts diff --xml <file> --sdk-out <log>
`;
}

function flag(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  if (i >= 0) return process.argv[i + 1];
  return undefined;
}

function readPayload(value: string): string {
  if (existsSync(value)) return readFileSync(value, "utf8").trim();
  return value.trim();
}

function emit(session: ReturnType<typeof validateSession>) {
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
    process.stdout.write(JSON.stringify(inspectSchemas(flag("--schemas")), null, 2) + "\n");
    return;
  }
  if (cmd === "qr") {
    emit(validateSession({ qrBase64: readPayload(args[1] ?? "") }));
    return;
  }
  if (cmd === "xml") {
    emit(validateSession({ xmlText: readPayload(args[1] ?? ""), xmlFileName: args[1] }));
    return;
  }
  if (cmd === "compare") {
    emit(validateSession({
      qrBase64: flag("--qr") ? readPayload(flag("--qr")!) : undefined,
      xmlText: flag("--xml") ? readPayload(flag("--xml")!) : undefined,
      xmlFileName: flag("--xml"),
    }));
    return;
  }
  process.stdout.write(help());
  process.exitCode = 1;
}

main();
