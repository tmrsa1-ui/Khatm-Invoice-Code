import assert from "node:assert/strict";
import test from "node:test";
import { inspectXmlFile } from "../../packages/xml-validator/src/index.ts";

test("XXE payload is rejected", () => {
  const xml = `<!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><Invoice>&xxe;</Invoice>`;
  const r = inspectXmlFile(xml);
  assert.equal(r.status, "FAILED");
  assert.equal(r.artifact.rejected, true);
});

test("well-formed invoice is not rejected by preflight", () => {
  const xml = `<?xml version="1.0"?><Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"><cbc:ID>1</cbc:ID></Invoice>`;
  const r = inspectXmlFile(xml);
  assert.equal(r.artifact.rejected, false);
});
