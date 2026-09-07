import assert from "node:assert/strict";
import test from "node:test";
import { inspectBusiness } from "../../packages/business-rules/src/index.ts";

test("negative totals fail", () => {
  const r = inspectBusiness({
    xmlText: "<Invoice><TaxExclusiveAmount>10</TaxExclusiveAmount><TaxAmount>-1</TaxAmount><TaxInclusiveAmount>9</TaxInclusiveAmount></Invoice>",
  });
  assert.equal(r.status, "FAILED");
  assert.equal(r.findings.some((f) => f.id === "KHTM-CALC-NEGATIVE"), true);
});

test("incomplete totals stay NOT_CHECKED", () => {
  const r = inspectBusiness({ xmlText: "<Invoice><TaxAmount>15</TaxAmount></Invoice>" });
  assert.equal(r.status, "NOT_CHECKED");
  assert.equal(r.findings.some((f) => f.id === "KHTM-CALC-INCOMPLETE"), true);
});

test("consistent three totals pass locally and are not an approval", () => {
  const r = inspectBusiness({
    xmlText: "<Invoice><TaxExclusiveAmount>1000.00</TaxExclusiveAmount><TaxAmount>150.00</TaxAmount><TaxInclusiveAmount>1150.00</TaxInclusiveAmount><PayableAmount>1150.00</PayableAmount></Invoice>",
  });
  assert.equal(r.status, "PASS_LOCAL_RULES");
  assert.equal(r.findings.some((f) => f.id === "KHTM-TOTALS-OK"), true);
  assert.match(r.findings.find((f) => f.id === "KHTM-TOTALS-OK")?.message_en || "", /Not an Authority approval/);
});

test("payable must match inclusive minus prepaid", () => {
  const r = inspectBusiness({
    xmlText: "<Invoice><TaxExclusiveAmount>100</TaxExclusiveAmount><TaxAmount>15</TaxAmount><TaxInclusiveAmount>115</TaxInclusiveAmount><PrepaidAmount>10</PrepaidAmount><PayableAmount>115</PayableAmount></Invoice>",
  });
  assert.equal(r.status, "FAILED");
  assert.equal(r.findings.some((f) => f.id === "KHTM-PAYABLE-MISMATCH"), true);
});

test("empty xml is not applicable", () => {
  assert.equal(inspectBusiness({ xmlText: "   " }).status, "NOT_APPLICABLE");
});
