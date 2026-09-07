import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

test("every living HTML page states C14N INCONCLUSIVE and does not claim approval", () => {
  const dir = "apps/web";
  const pages = readdirSync(dir).filter((n) => n.endsWith(".html") && n !== "404.html" && n !== "offline.html");
  assert.ok(pages.length >= 6);
  for (const name of pages) {
    const html = readFileSync(join(dir, name), "utf8");
    assert.match(html, /INCONCLUSIVE/, name);
    assert.match(html, /connect-src 'none'/, name);
    assert.equal(/معتمدة/.test(html) && !/ليس اعتماد/.test(html), false, name);
  }
});

test("QR page keeps paste fallback next to camera", () => {
  const html = readFileSync("apps/web/qr.html", "utf8") + readFileSync("apps/web/app.js", "utf8");
  assert.match(html, /الصق/);
  assert.match(html, /getUserMedia|BarcodeDetector/);
  assert.doesNotMatch(html, /window\.alert/);
});
