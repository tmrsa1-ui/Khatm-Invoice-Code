import assert from "node:assert/strict";
import test from "node:test";
import { encodeQrBase64, inspectQr, OFFICIAL_BOBS_RECORDS_B64 } from "../../packages/qr-tlv/src/index.ts";
import { validateSession, crossCheck } from "../../packages/validation-core/src/index.ts";
import { computeInvoiceHash } from "../../packages/crypto-validator/src/index.ts";

test("QR missing required tags fails locally", () => {
  const b64 = encodeQrBase64([{ tag: 1, value: "OnlySeller" }]);
  const r = inspectQr(b64);
  assert.equal(r.status, "FAILED");
  assert.equal(r.findings.some((f) => f.id === "QR-MISSING-TAG-2"), true);
});

test("session keeps C14N INCONCLUSIVE and XSD NOT_CHECKED", () => {
  const s = validateSession({ qrBase64: OFFICIAL_BOBS_RECORDS_B64 });
  assert.equal(s.layers.find((l) => l.layer === "crypto")?.status, "INCONCLUSIVE");
  assert.equal(s.layers.find((l) => l.layer === "xsd")?.status, "NOT_CHECKED");
  assert.equal(s.layers.find((l) => l.layer === "sdk")?.status, "NOT_CHECKED");
  assert.equal(computeInvoiceHash("<Invoice/>").implemented, false);
  assert.equal(computeInvoiceHash("<Invoice/>").canonicalization, "xml-c14n11");
  assert.notEqual(s.overall_status, "PASS_OFFICIAL_SDK");
  assert.match(s.disclaimer_ar, /ليس اعتمادًا/);
  assert.equal(s.findings.some((f) => f.id === "CRYPTO-C14N-INCONCLUSIVE"), true);
});

test("QR vs XML mismatch fails the cross layer", () => {
  const xml = `<?xml version="1.0"?><Invoice xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"><cbc:RegistrationName>Other Co</cbc:RegistrationName><cbc:CompanyID>310122393500003</cbc:CompanyID><cbc:PayableAmount>1000.00</cbc:PayableAmount><cbc:TaxAmount>150.00</cbc:TaxAmount></Invoice>`;
  const s = validateSession({ qrBase64: OFFICIAL_BOBS_RECORDS_B64, xmlText: xml });
  assert.equal(s.layers.find((l) => l.layer === "cross")?.status, "FAILED");
  assert.equal(s.overall_status, "FAILED");
  assert.equal(s.findings.some((f) => f.id === "XCHECK-MISMATCH"), true);
});

test("crossCheck is NOT_APPLICABLE without both artifacts", () => {
  assert.equal(crossCheck(undefined, undefined).status, "NOT_APPLICABLE");
});
