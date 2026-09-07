import assert from "node:assert/strict";
import test from "node:test";
import { inspectQr, parseQr } from "../../packages/qr-tlv/src/index.ts";
import { validateSession } from "../../packages/validation-core/src/index.ts";

export const OFFICIAL_SAMPLE =
  "AQxCb2JzIFJlY29yZHMCDzMxMDEyMjM5MzUwMDAwMwMUMjAyMi0wNC0yNVQxNTozMDowMFoEBzEwMDAuMDAFBjE1MC4wMA==";

test("official ZATCA QR sample decodes tag/length/value exactly", () => {
  const parsed = parseQr(OFFICIAL_SAMPLE);
  assert.ok(parsed.fields.length >= 5);
  const byTag = Object.fromEntries(parsed.fields.map((f) => [f.tag, f]));
  assert.equal(byTag[1].textValue, "Bobs Records");
  assert.equal(byTag[2].textValue, "310122393500003");
  assert.equal(byTag[4].textValue, "1000.00");
  assert.equal(byTag[5].textValue, "150.00");
});

test("QR-only session does not become an official approval", () => {
  const session = validateSession({ qrBase64: OFFICIAL_SAMPLE });
  assert.notEqual(session.overall_status, "PASS_OFFICIAL_SDK");
  assert.match(session.disclaimer_ar, /ليس اعتمادًا/);
  assert.ok(inspectQr(OFFICIAL_SAMPLE).findings.length >= 1);
});
