/* Browser engine — local only. Mirrors packages/* conservatively. No network. */
(function (global) {
  const DISCLAIMER_AR = "اجتازت الفاتورة القواعد المحلية المتاحة في إصدار القواعد المذكور. هذا فحص تقني مستقل وليس اعتمادًا من هيئة الزكاة والضريبة والجمارك.";
  const DISCLAIMER_EN = "The invoice passed the local rules available in the cited ruleset version. This is an independent technical inspection and is not an approval by the Zakat, Tax and Customs Authority.";
  const RULESET = { id: "zatca-2023-05-19", version: "2023-05-19", published_date: "2023-05-19", qr_base64_max: 700 };
  const OFFICIAL_BOBS = "AQxCb2JzIFJlY29yZHMCDzMxMDEyMjM5MzUwMDAwMwMUMjAyMi0wNC0yNVQxNTozMDowMFoEBzEwMDAuMDAFBjE1MC4wMA==";
  const TAG_NAMES = { 1: "seller_name", 2: "vat_number", 3: "timestamp", 4: "invoice_total", 5: "vat_amount", 6: "invoice_hash", 7: "ecdsa_signature", 8: "ecdsa_public_key", 9: "cryptographic_stamp" };
  const QR_SRC = { document: "ZATCA Guide to Developed FATOORA Compliant QR Code", rule_reference: "TLV + Base64", url: "https://zatca.gov.sa/en/E-Invoicing/SystemsDevelopers/Documents/QRCodeCreation.pdf", ruleset_version: "2021-11-18", published_date: "2021-11-18" };
  const SEC_SRC = { document: "ZATCA Electronic Invoice Security Features Implementation Standards v1.2", rule_reference: "QR payload size / C14N11", url: "https://zatca.gov.sa/ar/E-Invoicing/SystemsDevelopers/Documents/20230519_ZATCA_Electronic_Invoice_Security_Features_Implementation_Standards_vF.pdf", ruleset_version: "2023-05-19", published_date: "2023-05-19" };
  const XML_SRC = { document: "ZATCA Electronic Invoice XML Implementation Standard v1.2", rule_reference: "Well-formed XML / no DTD", url: "https://zatca.gov.sa/ar/E-Invoicing/SystemsDevelopers/Documents/20230519_ZATCA_Electronic_Invoice_XML_Implementation_Standard_%20vF.pdf", ruleset_version: "2023-05-19", published_date: "2023-05-19" };
  function finding(partial) {
    return Object.assign({ layer: "qr", severity: "info", category: "general", status: "NOT_CHECKED", title_ar: "", title_en: "", message_ar: "", message_en: "", source: QR_SRC, evidence: {}, suggested_action_ar: "", suggested_action_en: "", auto_fix_available: false }, partial);
  }
  function decodeBase64(s) {
    const t = String(s || "").trim().replace(/\s+/g, "");
    if (!t) return { ok: false, error: "empty" };
    if (/^https?:\/\//i.test(t) || t.includes("://")) return { ok: false, error: "url-payload" };
    if (!/^[A-Za-z0-9+/]+=*$/.test(t)) return { ok: false, error: "invalid-base64" };
    try {
      const padded = t + "=".repeat((4 - (t.length % 4)) % 4);
      const bin = atob(padded);
      const out = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
      if (!out.length && t.replace(/=/g, "").length) return { ok: false, error: "invalid-base64" };
      return { ok: true, compact: t, bytes: out };
    } catch { return { ok: false, error: "invalid-base64" }; }
  }
  function parseTlv(bytes) {
    const fields = []; const errors = [];
    let i = 0;
    const dec = new TextDecoder("utf-8", { fatal: false });
    while (i < bytes.length) {
      if (i + 2 > bytes.length) { errors.push("truncated-header"); break; }
      const tag = bytes[i], length = bytes[i + 1]; i += 2;
      if (i + length > bytes.length) { errors.push("truncated-value"); break; }
      const raw = bytes.slice(i, i + length);
      fields.push({ tag, length, rawBytes: Array.from(raw), rawHex: Array.from(raw).map(function (b) { return b.toString(16).padStart(2, "0"); }).join(""), textValue: dec.decode(raw), name_en: TAG_NAMES[tag] || ("tag_" + tag) });
      i += length;
    }
    return { fields, errors };
  }
  function inspectQr(raw) {
    const compact = String(raw || "").trim().replace(/\s+/g, "");
    const findings = [];
    const decoded = decodeBase64(compact);
    if (!decoded.ok) {
      const artifact = { rawBase64: compact, byteLength: 0, fields: [], errors: [decoded.error] };
      findings.push(finding({ id: decoded.error === "url-payload" ? "QR-URL-PAYLOAD" : "QR-INVALID-BASE64", layer: "qr", severity: "error", category: "qr", status: "FAILED", title_ar: "الرمز غير صالح", title_en: "QR is invalid", source: QR_SRC }));
      return { artifact, findings, status: "FAILED" };
    }
    const artifact = { rawBase64: decoded.compact, byteLength: decoded.bytes.length, fields: [], errors: [] };
    if (compact.length > RULESET.qr_base64_max) {
      findings.push(finding({ id: "QR-BASE64-OVERSIZE", layer: "qr", severity: "error", category: "qr", status: "FAILED", title_ar: "الحمولة أطول من الحد", title_en: "QR payload exceeds cap", source: SEC_SRC, evidence: { actual_value: compact.length, expected_value: RULESET.qr_base64_max } }));
    }
    const tlv = parseTlv(decoded.bytes);
    artifact.fields = tlv.fields; artifact.errors = tlv.errors;
    if (tlv.errors.length) {
      findings.push(finding({ id: "QR-TLV-TRUNCATED", layer: "qr", severity: "error", category: "qr", status: "FAILED", title_ar: "TLV ناقص", title_en: "TLV truncated", source: QR_SRC }));
      return { artifact, findings, status: "FAILED" };
    }
    const tags = tlv.fields.map(function (f) { return f.tag; });
    for (const req of [1, 2, 3, 4, 5]) {
      if (tags.indexOf(req) < 0) findings.push(finding({ id: "QR-MISSING-TAG-" + req, layer: "qr", severity: "error", category: "qr", status: "FAILED", title_ar: "الوسم " + req + " مفقود", title_en: "Tag missing", source: QR_SRC }));
    }
    const failed = findings.some(function (f) { return f.status === "FAILED"; });
    if (!failed) findings.push(finding({ id: "QR-TLV-OK", layer: "qr", severity: "info", category: "qr", status: "PASS_LOCAL_RULES", title_ar: "بنية TLV المحلية مقبولة", title_en: "Local TLV acceptable", message_ar: "فحص بنيوي محلي وليس اعتمادًا.", source: QR_SRC }));
    return { artifact, findings, status: failed ? "FAILED" : "PASS_LOCAL_RULES" };
  }
  function firstTag(text, local) {
    const re = new RegExp("<(?:[A-Za-z0-9._-]+:)?" + local + "\\b[^>]*>([^<]*)</(?:[A-Za-z0-9._-]+:)?" + local + ">", "i");
    const m = text.match(re);
    return m ? m[1].trim() : null;
  }
  function money(v) {
    if (v == null || v === "") return null;
    const n = Number(String(v).replace(/,/g, ""));
    return Number.isFinite(n) ? n : null;
  }
  function inspectXml(text, fileName) {
    const raw = String(text || "");
    const artifact = { fileName: fileName || null, wellFormed: false, rejected: false, namespaces: {}, textExcerpt: raw.slice(0, 240), sellerName: null, vatNumber: null, payableAmount: null, taxAmount: null };
    const findings = [];
    if (raw.length > 2 * 1024 * 1024) {
      artifact.rejected = true; artifact.rejectReason = "oversize";
      findings.push(finding({ id: "XML-OVERSIZE", layer: "file", severity: "error", status: "FAILED", title_ar: "الملف أكبر من حد الفحص", title_en: "File exceeds 2 MiB cap" }));
      return { artifact, findings, status: "FAILED" };
    }
    if (/<!DOCTYPE|<!ENTITY/i.test(raw) || /SYSTEM\s+["']|PUBLIC\s+["']/.test(raw)) {
      artifact.rejected = true; artifact.rejectReason = "dtd-or-entity";
      findings.push(finding({ id: "XML-UNSAFE-PREFLIGHT", layer: "file", severity: "error", category: "xml-security", status: "FAILED", title_ar: "رُفض الملف قبل التحليل", title_en: "File rejected before parsing", source: XML_SRC }));
      return { artifact, findings, status: "FAILED" };
    }
    const trimmed = raw.trim();
    if (!trimmed.startsWith("<")) {
      artifact.rejected = true;
      findings.push(finding({ id: "XML-NOT-WELL-FORMED", layer: "xml", severity: "error", status: "FAILED", title_ar: "ليس XML", title_en: "Not XML", source: XML_SRC }));
      return { artifact, findings, status: "FAILED" };
    }
    artifact.sellerName = (raw.match(/cbc:RegistrationName[^>]*>([^<]+)/) || [])[1] || null;
    artifact.vatNumber = (raw.match(/cbc:CompanyID[^>]*>([^<]+)/) || [])[1] || null;
    artifact.payableAmount = firstTag(raw, "PayableAmount") || firstTag(raw, "TaxInclusiveAmount");
    artifact.taxAmount = firstTag(raw, "TaxAmount");
    artifact.wellFormed = true;
    findings.push(finding({ id: "XML-PREFLIGHT-OK", layer: "xml", severity: "info", category: "xml", status: "PASS_LOCAL_RULES", title_ar: "اجتاز الفحص البنيوي — XSD غير مفحوص", title_en: "Local well-formed check passed — XSD not run", source: XML_SRC }));
    return { artifact, findings, status: "PASS_LOCAL_RULES" };
  }
  function inspectBusiness(xmlText, xmlArt) {
    const text = String(xmlText || "");
    if (!text.trim() || (xmlArt && xmlArt.rejected)) return { findings: [], status: "NOT_CHECKED" };
    const exclusive = money(firstTag(text, "TaxExclusiveAmount"));
    const inclusive = money(firstTag(text, "TaxInclusiveAmount")) || money(firstTag(text, "PayableAmount"));
    const tax = money(firstTag(text, "TaxAmount"));
    if (exclusive != null && tax != null && inclusive != null && Math.abs(exclusive + tax - inclusive) >= 0.02) {
      return { status: "FAILED", findings: [finding({ id: "KHTM-CALC-TOTALS-MISMATCH", layer: "business", severity: "error", category: "totals", status: "FAILED", title_ar: "المجاميع غير متسقة", title_en: "Local totals mismatch", source: XML_SRC })] };
    }
    return { status: "PASS_LOCAL_RULES", findings: [] };
  }
  function inspectCrypto() {
    return { status: "INCONCLUSIVE", findings: [finding({ id: "CRYPTO-C14N-INCONCLUSIVE", layer: "crypto", severity: "info", category: "crypto", status: "INCONCLUSIVE", title_ar: "التجزئة غير حاسمة", title_en: "Invoice hash is inconclusive", message_ar: "C14N11 غير مكتمل.", source: SEC_SRC })] };
  }
  function crossCheck(qrArt, xmlArt) {
    if (!qrArt || !xmlArt || xmlArt.rejected) return { findings: [], status: "NOT_APPLICABLE" };
    const field = function (tag) { const f = qrArt.fields.find(function (x) { return x.tag === tag; }); return f && f.textValue; };
    const mismatches = [];
    if (field(1) && xmlArt.sellerName && field(1).trim() !== String(xmlArt.sellerName).trim()) mismatches.push("sellerName");
    if (field(2) && xmlArt.vatNumber && field(2).trim() !== String(xmlArt.vatNumber).trim()) mismatches.push("vatNumber");
    const qrTotal = money(field(4)), xmlTotal = money(xmlArt.payableAmount);
    if (qrTotal != null && xmlTotal != null && Math.abs(qrTotal - xmlTotal) >= 0.02) mismatches.push("total");
    if (mismatches.length) return { status: "FAILED", findings: [finding({ id: "XCHECK-MISMATCH", layer: "cross", severity: "error", category: "cross-check", status: "FAILED", title_ar: "الرمز لا يطابق XML", title_en: "QR fields do not match XML", source: QR_SRC, evidence: { related_fields: mismatches } })] };
    return { status: "PASS_LOCAL_RULES", findings: [finding({ id: "XCHECK-OK", layer: "cross", category: "cross-check", status: "PASS_LOCAL_RULES", title_ar: "الحقول المشتركة متوافقة", title_en: "Shared fields match", source: QR_SRC })] };
  }
  function rollupStatus(layers) {
    const statuses = layers.map(function (l) { return l.status; });
    if (statuses.indexOf("FAILED") >= 0) return "FAILED";
    if (statuses.indexOf("INCONCLUSIVE") >= 0) return "INCONCLUSIVE";
    const material = layers.filter(function (l) { return l.status !== "NOT_APPLICABLE"; });
    const checked = material.filter(function (l) { return l.checked !== false && l.status !== "NOT_CHECKED"; });
    const hasUnchecked = material.some(function (l) { return l.status === "NOT_CHECKED" || l.checked === false; });
    if (checked.length && hasUnchecked) return "INCONCLUSIVE";
    if (!checked.length) return "NOT_CHECKED";
    return "PASS_LOCAL_RULES";
  }
  function validateSession(input) {
    const findings = []; const layers = [];
    let qrArt, xmlArt;
    if (input && input.qrBase64) {
      const qr = inspectQr(input.qrBase64); qrArt = qr.artifact; findings.push.apply(findings, qr.findings);
      layers.push({ layer: "qr", status: qr.status, checked: true });
    }
    if (input && input.xmlText) {
      const xml = inspectXml(input.xmlText, input.xmlFileName); xmlArt = xml.artifact; findings.push.apply(findings, xml.findings);
      layers.push({ layer: xml.artifact.rejected ? "file" : "xml", status: xml.status, checked: true });
    }
    if (qrArt || xmlArt) {
      const biz = inspectBusiness(input && input.xmlText, xmlArt);
      findings.push.apply(findings, biz.findings);
      layers.push({ layer: "business", status: biz.status, checked: biz.status !== "NOT_CHECKED" });
      const crypto = inspectCrypto();
      findings.push.apply(findings, crypto.findings);
      layers.push({ layer: "crypto", status: crypto.status, checked: true });
      if (qrArt && xmlArt && !xmlArt.rejected) {
        const cross = crossCheck(qrArt, xmlArt);
        findings.push.apply(findings, cross.findings);
        layers.push({ layer: "cross", status: cross.status, checked: true });
      }
    }
    findings.push(finding({ id: "XSD-NOT-CHECKED", layer: "xsd", category: "schema", status: "NOT_CHECKED", title_ar: "لم يُشغَّل XSD", title_en: "XSD not run", source: XML_SRC }));
    layers.push({ layer: "xsd", status: "NOT_CHECKED", checked: false });
    findings.push(finding({ id: "SDK-NOT-CHECKED", layer: "sdk", category: "sdk", status: "NOT_CHECKED", title_ar: "SDK غير مستدعى", title_en: "SDK not invoked", source: SEC_SRC }));
    layers.push({ layer: "sdk", status: "NOT_CHECKED", checked: false });
    return {
      id: "web-" + Date.now(), created_at: new Date().toISOString(), app_version: "0.1.0-beta", ruleset: RULESET,
      inputs: { qr: !!(input && input.qrBase64), xml: !!(input && input.xmlText) },
      layers, findings, overall_status: rollupStatus(layers),
      disclaimer_ar: DISCLAIMER_AR, disclaimer_en: DISCLAIMER_EN, qr: qrArt, xml: xmlArt
    };
  }
  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/&/g, "\u0026amp;").replace(/</g, "\u0026lt;").replace(/>/g, "\u0026gt;").replace(/"/g, "\u0026quot;");
  }
  function renderJson(session) { return JSON.stringify(session || {}, null, 2); }
  function renderHtml(session) {
    const s = session || {};
    return "<!doctype html><html lang=\"ar\" dir=\"rtl\"><meta charset=\"utf-8\"><p>" + escapeHtml(s.disclaimer_ar) + "</p><p>status=" + escapeHtml(s.overall_status) + "</p></html>";
  }
  global.KhatmEngine = {
    inspectQr: inspectQr, inspectXml: inspectXml, compare: function (q, x) { return validateSession({ qrBase64: q, xmlText: x }); },
    rollupStatus: rollupStatus, validateSession: validateSession, escapeHtml: escapeHtml, renderHtml: renderHtml, renderJson: renderJson,
    DISCLAIMER_AR: DISCLAIMER_AR, DISCLAIMER_EN: DISCLAIMER_EN, RULESET: RULESET,
    OFFICIAL_BOBS: OFFICIAL_BOBS, SAMPLE: OFFICIAL_BOBS, SAMPLE_QR: OFFICIAL_BOBS,
    STATUS_AR: { PASS_LOCAL_RULES: "اجتاز القواعد المحلية", FAILED: "فشل", INCONCLUSIVE: "غير حاسم", NOT_CHECKED: "لم يُفحص" }
  };
})(typeof window !== "undefined" ? window : globalThis);
