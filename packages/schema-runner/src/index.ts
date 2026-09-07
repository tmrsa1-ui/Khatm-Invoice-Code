import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";

export function resolveSchemaDir(explicit?: string): string | undefined {
  return explicit || process.env.KHATM_SCHEMA_DIR;
}

export function sha256File(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

export function verifyPin(path: string, expectedHex: string): boolean {
  return sha256File(path).toLowerCase() === String(expectedHex || "").toLowerCase();
}

export function inspectSchemas(explicit?: string) {
  const dir = resolveSchemaDir(explicit);
  const source = {
    document: "Optional local XSD/Schematron (not vendored)",
    rule_reference: "schema-runner",
    ruleset_version: "user-supplied",
  };
  if (!dir || !existsSync(dir)) {
    return {
      status: "NOT_CHECKED" as const,
      files: [] as string[],
      findings: [{
        id: "XSD-NOT-CHECKED",
        layer: "xsd",
        status: "NOT_CHECKED",
        title_ar: "لم يُشغَّل XSD/Schematron",
        title_en: "XSD/Schematron was not run",
        message_ar: "المخططات غير مضمّنة في Git. عيّن KHATM_SCHEMA_DIR.",
        source,
      }],
    };
  }
  const files = readdirSync(dir).filter((f) => /\.(xsd|sch)$/i.test(f));
  return {
    status: "NOT_CHECKED" as const,
    files,
    findings: [{
      id: "XSD-PRESENT-NOT-EXECUTED",
      layer: "xsd",
      status: "NOT_CHECKED",
      title_ar: "وُجدت مخططات محلية ولم يُشغَّل المحرّك",
      title_en: "Local schemas exist and were not executed",
      message_ar: files.join(", ") || dir,
      source,
    }],
  };
}
