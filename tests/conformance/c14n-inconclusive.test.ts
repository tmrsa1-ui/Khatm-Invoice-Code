import assert from "node:assert/strict";
import test from "node:test";
import { computeInvoiceHash } from "../../packages/crypto-validator/src/index.ts";

test("C14N11 invoice hash stays INCONCLUSIVE without the official transform", () => {
  const r = computeInvoiceHash("<Invoice></Invoice>");
  assert.equal(r.status, "INCONCLUSIVE");
  assert.equal(r.implemented, false);
  assert.equal(r.canonicalization, "xml-c14n11");
});
