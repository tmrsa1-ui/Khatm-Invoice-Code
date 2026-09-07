import assert from "node:assert/strict";
import test from "node:test";
import { inspectXmlFile } from "../../packages/xml-validator/src/index.ts";
import { inspectBusiness } from "../../packages/business-rules/src/index.ts";

test("XML larger than 2 MiB is rejected", () => {
  const xml = "<Invoice>" + "a".repeat(2 * 1024 * 1024) + "</Invoice>";
  const r = inspectXmlFile(xml);
  assert.equal(r.status, "FAILED");
  assert.equal(r.artifact.rejectReason, "oversize");
});

test("xinclude and xml-stylesheet are rejected", () => {
  assert.equal(inspectXmlFile('<Invoice xmlns:xi="http://www.w3.org/2001/XInclude"><xi:include href="file:///etc/passwd"/></Invoice>').status, "FAILED");
  assert.equal(inspectXmlFile('<?xml-stylesheet href="http://evil" type="text/xsl"?><Invoice></Invoice>').status, "FAILED");
});

test("negative totals fail local arithmetic", () => {
  const xml = `<Invoice><TaxExclusiveAmount>-1</TaxExclusiveAmount><TaxAmount>1</TaxAmount><TaxInclusiveAmount>0</TaxInclusiveAmount></Invoice>`;
  const r = inspectBusiness({ xmlText: xml });
  assert.equal(r.status, "FAILED");
  assert.equal(r.findings[0].id, "KHTM-CALC-NEGATIVE");
});

test("incomplete totals are NOT_CHECKED, not a local pass", () => {
  const r = inspectBusiness({ xmlText: "<Invoice><TaxAmount>1</TaxAmount></Invoice>" });
  assert.equal(r.status, "NOT_CHECKED");
});
