import assert from "node:assert/strict";
import test from "node:test";
import { inspectXmlFile } from "../../packages/xml-validator/src/index.ts";

test("PHP processing instruction is rejected", () => {
  const r = inspectXmlFile(`<?php system('id'); ?><Invoice><cbc:ID>1</cbc:ID></Invoice>`);
  assert.equal(r.status, "FAILED");
  assert.equal(r.artifact.rejected, true);
});

test("unclosed comment is rejected", () => {
  const r = inspectXmlFile(`<Invoice><!-- never closed<cbc:ID>1</cbc:ID></Invoice>`);
  assert.equal(r.status, "FAILED");
});

test("html disguise is rejected", () => {
  const r = inspectXmlFile(`<html><script>alert(1)</script></html>`);
  assert.equal(r.status, "FAILED");
});

test("xml-stylesheet PI is rejected", () => {
  const r = inspectXmlFile(`<?xml-stylesheet href="evil.xsl" type="text/xsl"?><Invoice><cbc:ID>1</cbc:ID></Invoice>`);
  assert.equal(r.status, "FAILED");
});

test("XInclude is rejected", () => {
  const r = inspectXmlFile(`<Invoice xmlns:xi="http://www.w3.org/2001/XInclude"><xi:include href="/etc/passwd"/></Invoice>`);
  assert.equal(r.status, "FAILED");
});

test("control character payload is rejected", () => {
  const r = inspectXmlFile(`<Invoice><cbc:ID>1\x07</cbc:ID></Invoice>`);
  assert.equal(r.status, "FAILED");
});

test("incomplete root is not a local pass", () => {
  const r = inspectXmlFile(`<Invoice><cbc:ID>1</cbc:ID>`);
  assert.equal(r.status, "FAILED");
  assert.equal(r.artifact.wellFormed, false);
});
