import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import vm from "node:vm";

type Engine = {
  escapeHtml: (v: unknown) => string;
  inspectXml: (t: string) => { status: string };
  inspectBusiness: (t: string) => { status: string };
  computeInvoiceHash: () => { status: string; implemented: boolean; canonicalization: string };
  validateSession: (i: { qrBase64?: string; xmlText?: string }) => {
    overall_status: string;
    findings: Array<{ id: string; status: string }>;
    layers: Array<{ layer: string; status: string }>;
  };
};

function loadEngine(): Engine {
  const code = readFileSync(new URL("../../apps/web/engine.js", import.meta.url), "utf8");
  const sandbox: Record<string, unknown> = {
    TextDecoder,
    atob: (s: string) => Buffer.from(s, "base64").toString("binary"),
    btoa: (s: string) => Buffer.from(s, "binary").toString("base64"),
  };
  vm.runInNewContext(code, sandbox);
  return sandbox.KhatmEngine as Engine;
}

const OFFICIAL =
  "AQxCb2JzIFJlY29yZHMCDzMxMDEyMjM5MzUwMDAwMwMUMjAyMi0wNC0yNVQxNTozMDowMFoEBzEwMDAuMDAFBjE1MC4wMA==";

test("browser engine escapes HTML in reports", () => {
  const E = loadEngine();
  const out = E.escapeHtml('<img src=x onerror="alert(1)"> & "');
  assert.equal(out.includes("<"), false);
  assert.equal(out.includes("\u0026lt;"), true);
  assert.equal(out.includes("\u0026amp;"), true);
  assert.equal(out.includes("\u0026quot;"), true);
});

test("browser engine official QR is local-pass on QR layer and inconclusive overall", () => {
  const E = loadEngine();
  const s = E.validateSession({ qrBase64: OFFICIAL });
  assert.equal(s.layers.find((l) => l.layer === "qr")?.status, "PASS_LOCAL_RULES");
  assert.equal(s.layers.find((l) => l.layer === "crypto")?.status, "INCONCLUSIVE");
  assert.equal(s.overall_status, "INCONCLUSIVE");
  assert.equal(s.findings.some((f) => f.id === "CRYPTO-C14N-INCONCLUSIVE"), true);
});

test("browser engine rejects XXE and incomplete XML", () => {
  const E = loadEngine();
  assert.equal(E.inspectXml('<!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><Invoice>&xxe;</Invoice>').status, "FAILED");
  assert.equal(E.inspectXml("<Invoice>").status, "FAILED");
  assert.equal(E.inspectXml("not xml").status, "FAILED");
});

test("browser engine does not pass arithmetic without the three totals", () => {
  const E = loadEngine();
  const r = E.inspectBusiness("<Invoice><TaxAmount>1</TaxAmount></Invoice>");
  assert.notEqual(r.status, "PASS_LOCAL_RULES");
});

test("computeInvoiceHash stays unimplemented", () => {
  const E = loadEngine();
  const h = E.computeInvoiceHash();
  assert.equal(h.status, "INCONCLUSIVE");
  assert.equal(h.implemented, false);
  assert.equal(h.canonicalization, "xml-c14n11");
});
