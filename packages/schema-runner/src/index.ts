import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import type { ResultStatus, ValidationFinding } from "../../shared-types/src/index.ts";

export function resolveSchemaDir(explicit?: string): string | undefined {
  return explicit || process.env.KHATM_SCHEMA_DIR;
}

export function inspectSchemas(explicit?: string): {
  status: ResultStatus;
  findings: ValidationFinding[];
  files: string[];
} {
  const dir = resolveSchemaDir(explicit);
  const source = {
    document: "Optional local XSD/Schematron (not vendored)",
    rule_reference: "schema-runner",
    url: "https://zatca.gov.sa/en/E-Invoicing/SystemsDevelopers/Pages/E-Invoice-specifications.aspx",
    ruleset_version: "user-supplied",
  };
  if (!dir) {
    return {
      status: "NOT_CHECKED",
      files: [],
      findings: [{
        id: "XSD-NOT-CHECKED",
        layer: "xsd",
        severity: "info",
        category: "schema",
        status: "NOT_CHECKED",
        title_ar: "لم يُشغَّل XSD/Schematron",
        title_en: "XSD/Schematron was not run",
        message_ar: "المخططات غير مضمّنة في Git. عيّن KHATM_SCHEMA_DIR لمجلد محلي.",
        message_en: "Schemas are not vendored. Set KHATM_SCHEMA_DIR to a local folder.",
        source,
        evidence: {},
        suggested_action_ar: "لا توزّع ملفات الهيئة داخل المستودع.",
        suggested_action_en: "Do not vendor Authority files in the repository.",
        auto_fix_available: false,
      }],
    };
  }
  if (!existsSync(dir)) {
    return {
      status: "NOT_CHECKED",
      files: [],
      findings: [{
        id: "XSD-DIR-MISSING",
        layer: "xsd",
        severity: "warning",
        category: "schema",
        status: "NOT_CHECKED",
        title_ar: "مجلد المخططات غير موجود",
        title_en: "Schema directory does not exist",
        message_ar: dir,
        message_en: dir,
        source,
        evidence: { actual_value: dir },
        suggested_action_ar: "تحقق من المسار المحلي.",
        suggested_action_en: "Check the local path.",
        auto_fix_available: false,
      }],
    };
  }
  const files = readdirSync(dir).filter((f) => /\.(xsd|sch)$/i.test(f));
  if (!files.length) {
    return {
      status: "NOT_CHECKED",
      files: [],
      findings: [{
        id: "XSD-DIR-EMPTY",
        layer: "xsd",
        severity: "info",
        category: "schema",
        status: "NOT_CHECKED",
        title_ar: "المجلد لا يحتوي XSD/Schematron",
        title_en: "Directory contains no XSD/Schematron",
        message_ar: dir,
        message_en: dir,
        source,
        evidence: { actual_value: dir },
        suggested_action_ar: "ضع الملفات بعد قبول ترخيصها خارج Git.",
        suggested_action_en: "Place the files after accepting their license, outside git.",
        auto_fix_available: false,
      }],
    };
  }
  return {
    status: "NOT_CHECKED",
    files,
    findings: [{
      id: "XSD-PRESENT-NOT-EXECUTED",
      layer: "xsd",
      severity: "info",
      category: "schema",
      status: "NOT_CHECKED",
      title_ar: "وُجدت مخططات محلية ولم يُشغَّل المحرّك بعد",
      title_en: "Local schemas exist and the runner is not executed yet",
      message_ar: files.join(", "),
      message_en: files.join(", "),
      source,
      evidence: { actual_value: files.join(",") },
      suggested_action_ar: "تشغيل XSD خطوة لاحقة منفصلة عن النجاح المحلي.",
      suggested_action_en: "Running XSD is a later step, separate from a local pass.",
      auto_fix_available: false,
    }],
  };
}

export function inspectSchemaBundle(root: string | null | undefined) {
  const result = inspectSchemas(root ?? undefined);
  return {
    root: root ?? null,
    present: result.files.length > 0,
    files: result.files,
    xsdCount: result.files.filter((f) => /\.xsd$/i.test(f)).length,
    schematronCount: result.files.filter((f) => /\.sch$/i.test(f)).length,
    fatooraPath: null,
    engine: "none",
  };
}

export function runSchemaLayers(options: { schemaDir?: string } = {}) {
  const inspected = inspectSchemas(options.schemaDir);
  return {
    bundle: inspectSchemaBundle(options.schemaDir ?? null),
    findings: inspected.findings,
    status: inspected.status,
  };
}

export function sha256File(filePath: string): string {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

export function verifyPin(path: string, expectedHex: string): boolean {
  return sha256File(path).toLowerCase() === String(expectedHex || "").toLowerCase();
}

export function verifyUserSchemaPins(schemaDir: string | undefined, pinsPath: string | undefined): {
  status: "NOT_CHECKED" | "FAILED" | "PASS_LOCAL_RULES";
  findings: { id: string; status: string; message_en: string; message_ar: string }[];
} {
  if (!schemaDir || !pinsPath) {
    return {
      status: "NOT_CHECKED",
      findings: [{
        id: "SCHEMA-PIN-NOT-CHECKED",
        status: "NOT_CHECKED",
        message_en: "No local schema directory or pins sidecar. Official XSD is not vendored.",
        message_ar: "لا مجلد مخططات ولا ملف تثبيت. ملفات الهيئة غير مضمّنة.",
      }],
    };
  }
  if (!existsSync(schemaDir) || !existsSync(pinsPath)) {
    return {
      status: "NOT_CHECKED",
      findings: [{
        id: "SCHEMA-PIN-MISSING",
        status: "NOT_CHECKED",
        message_en: "Schema directory or pins file is missing.",
        message_ar: "مجلد المخططات أو ملف التثبيت غير موجود.",
      }],
    };
  }
  const pins = JSON.parse(readFileSync(pinsPath, "utf8"));
  const list = Array.isArray(pins) ? pins : pins.pins || [];
  const findings = [];
  let failed = false;
  for (const pin of list) {
    const name = pin.file || pin.source_name;
    if (!name || !pin.sha256) continue;
    const full = join(schemaDir, String(name));
    if (!existsSync(full)) {
      findings.push({
        id: "SCHEMA-PIN-FILE-ABSENT",
        status: "NOT_CHECKED",
        message_en: `Pinned file not found: ${name}`,
        message_ar: `الملف المثبّت غير موجود: ${name}`,
      });
      continue;
    }
    const actual = sha256File(full);
    if (actual !== String(pin.sha256).toLowerCase()) {
      failed = true;
      findings.push({
        id: "SCHEMA-PIN-MISMATCH",
        status: "FAILED",
        message_en: `sha256 mismatch for ${name}`,
        message_ar: `عدم تطابق sha256 لـ ${name}`,
      });
    } else {
      findings.push({
        id: "SCHEMA-PIN-MATCH",
        status: "NOT_CHECKED",
        message_en: `${name} matches the user-supplied integrity pin (not XSD execution).`,
        message_ar: `${name} يطابق تثبيت السلامة الذي وفّره المستخدم (ليس تشغيل XSD).`,
      });
    }
  }
  if (!findings.length) {
    return {
      status: "NOT_CHECKED",
      findings: [{
        id: "SCHEMA-PIN-EMPTY",
        status: "NOT_CHECKED",
        message_en: "Pins sidecar had no file+sha256 entries.",
        message_ar: "ملف التثبيت لا يحتوي مدخلات file+sha256.",
      }],
    };
  }
  return { status: failed ? "FAILED" : "NOT_CHECKED", findings };
}

export function runUserXsdIfPinned(options: {
  xmlText: string;
  schemaDir?: string;
  pinsPath?: string;
}): { status: "NOT_CHECKED" | "FAILED"; detail: string } {
  const pins = verifyUserSchemaPins(options.schemaDir, options.pinsPath);
  if (pins.status === "FAILED") {
    return { status: "FAILED", detail: "schema-pin-mismatch" };
  }
  if (pins.status === "NOT_CHECKED" && !pins.findings.some((f) => f.id === "SCHEMA-PIN-MATCH")) {
    return { status: "NOT_CHECKED", detail: "no-pinned-user-schema" };
  }
  const bin = process.env.KHATM_XMLLINT || "xmllint";
  const xsd = (options.schemaDir && existsSync(options.schemaDir))
    ? readdirSync(options.schemaDir).find((f) => /\.xsd$/i.test(f))
    : undefined;
  if (!options.schemaDir || !xsd) return { status: "NOT_CHECKED", detail: "no-xsd-file" };
  const result = spawnSync(bin, ["--noout", "--schema", join(options.schemaDir, xsd), "-"], {
    input: options.xmlText,
    encoding: "utf8",
    timeout: 8000,
  });
  if (result.error || result.status === 127) {
    return { status: "NOT_CHECKED", detail: "xmllint-not-available" };
  }
  if (result.status !== 0) {
    return { status: "FAILED", detail: (result.stderr || result.stdout || "xmllint-failed").slice(0, 400) };
  }
  return { status: "NOT_CHECKED", detail: "xmllint-ok-but-not-zatca-certification" };
}
