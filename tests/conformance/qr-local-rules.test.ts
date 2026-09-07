import assert from "node:assert/strict";
import test from "node:test";
import { encodeQrBase64, inspectQr, OFFICIAL_BOBS_RECORDS_B64 } from "../../packages/qr-tlv/src/index.ts";

test("official sample still passes local TLV rules", () => {
  const r = inspectQr(OFFICIAL_BOBS_RECORDS_B64);
  assert.equal(r.status, "PASS_LOCAL_RULES");
});

test("empty required tag fails", () => {
  const b64 = encodeQrBase64([
    { tag: 1, value: "" },
    { tag: 2, value: "310122393500003" },
    { tag: 3, value: "2022-04-25T15:30:00Z" },
    { tag: 4, value: "100.00" },
    { tag: 5, value: "15.00" },
  ]);
  const r = inspectQr(b64);
  assert.equal(r.status, "FAILED");
  assert.equal(r.findings.some((f) => f.id === "QR-EMPTY-TAG-1"), true);
});

test("duplicate required tag fails", () => {
  const b64 = encodeQrBase64([
    { tag: 1, value: "A" },
    { tag: 1, value: "B" },
    { tag: 2, value: "310122393500003" },
    { tag: 3, value: "2022-04-25T15:30:00Z" },
    { tag: 4, value: "100.00" },
    { tag: 5, value: "15.00" },
  ]);
  const r = inspectQr(b64);
  assert.equal(r.status, "FAILED");
  assert.equal(r.findings.some((f) => f.id === "QR-DUPLICATE-TAG-1"), true);
});

test("non-numeric total fails", () => {
  const b64 = encodeQrBase64([
    { tag: 1, value: "Seller" },
    { tag: 2, value: "310122393500003" },
    { tag: 3, value: "2022-04-25T15:30:00Z" },
    { tag: 4, value: "ten" },
    { tag: 5, value: "15.00" },
  ]);
  const r = inspectQr(b64);
  assert.equal(r.status, "FAILED");
  assert.equal(r.findings.some((f) => f.id === "QR-TOTAL-FORMAT"), true);
});
