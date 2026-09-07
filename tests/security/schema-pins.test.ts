import assert from "node:assert/strict";
import test from "node:test";
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { verifyUserSchemaPins, runUserXsdIfPinned } from "../../packages/schema-runner/src/index.ts";

test("schema pins stay NOT_CHECKED when no dir is given", () => {
  const r = verifyUserSchemaPins(undefined, undefined);
  assert.equal(r.status, "NOT_CHECKED");
});

test("schema pin mismatch fails integrity only", () => {
  const dir = join(tmpdir(), "khatm-schema-pin-" + process.pid);
  mkdirSync(dir, { recursive: true });
  const file = join(dir, "demo.xsd");
  writeFileSync(file, "<schema/>");
  const pins = join(dir, "pins.json");
  writeFileSync(pins, JSON.stringify({ pins: [{ file: "demo.xsd", sha256: "00".repeat(32) }] }));
  const r = verifyUserSchemaPins(dir, pins);
  assert.equal(r.status, "FAILED");
  assert.equal(r.findings.some((f) => f.id === "SCHEMA-PIN-MISMATCH"), true);
  rmSync(dir, { recursive: true, force: true });
});

test("matching user pin is integrity only, not a schema pass", () => {
  const dir = join(tmpdir(), "khatm-schema-ok-" + process.pid);
  mkdirSync(dir, { recursive: true });
  const body = "<schema/>";
  writeFileSync(join(dir, "demo.xsd"), body);
  const digest = createHash("sha256").update(body).digest("hex");
  const pins = join(dir, "pins.json");
  writeFileSync(pins, JSON.stringify({ pins: [{ file: "demo.xsd", sha256: digest }] }));
  const r = verifyUserSchemaPins(dir, pins);
  assert.equal(r.status, "NOT_CHECKED");
  assert.equal(r.findings.some((f) => f.id === "SCHEMA-PIN-MATCH"), true);
  rmSync(dir, { recursive: true, force: true });
});

test("xmllint is not run and stays NOT_CHECKED without a user pin", () => {
  const r = runUserXsdIfPinned({ xmlText: "<Invoice/>", schemaDir: undefined, pinsPath: undefined });
  assert.equal(r.status, "NOT_CHECKED");
  assert.equal(r.detail, "no-pinned-user-schema");
});
