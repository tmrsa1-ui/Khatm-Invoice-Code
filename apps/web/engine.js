/* Khatm Invoice — local browser engine. Not affiliated with ZATCA. */
(function (root) {
  const DISCLAIMER_AR = "اجتازت الفاتورة القواعد المحلية المتاحة في إصدار القواعد المذكور. هذا فحص تقني مستقل وليس اعتمادًا من هيئة الزكاة والضريبة والجمارك.";
  const DISCLAIMER_EN = "The invoice passed the local rules available in the cited ruleset version. This is an independent technical inspection and is not an approval by ZATCA.";
  const SAMPLE = "AQxCb2JzIFJlY29yZHMCDzMxMDEyMjM5MzUwMDAwMwMUMjAyMi0wNC0yNVQxNTozMDowMFoEBzEwMDAuMDAFBjE1MC4wMA==";
  const TAGS = { 1: "seller_name", 2: "vat_number", 3: "timestamp", 4: "invoice_total", 5: "vat_amount", 6: "invoice_hash", 7: "ecdsa_signature", 8: "ecdsa_public_key", 9: "cryptographic_stamp" };
  const SRC = { document: "ZATCA QRCodeCreation.pdf", rule_reference: "TLV + Base64", url: "https://zatca.gov.sa/en/E-Invoicing/SystemsDevelopers/Documents/QRCodeCreation.pdf", ruleset_version: "2023-05-19" };

  function b64(s) {
    try {
      const t = s.trim().replace(/\s+/g, "");
      if (!t) return { ok: false, error: "empty" };
      if (/^https?:/i.test(t)) return { ok: false, error: "url-payload" };
      const bin = atob(t);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return { ok: true, bytes, raw: t };
    } catch { return { ok: false, error: "invalid-base64" }; }
  }
  function parseTlv(bytes) {
    const fields = []; const errors = [];
    let i = 0;
    while (i < bytes.length) {
      if (i + 2 > bytes.length) { errors.push("truncated-header"); break; }
      const tag = bytes[i], length = bytes[i + 1]; i += 2;
      if (i + length > bytes.length) { errors.push("truncated-value"); break; }
      const raw = Array.from(bytes.slice(i, i + length));
      let text = null;
      try { text = new TextDecoder().decode(Uint8Array.from(raw)); } catch {}
      fields.push({ tag, length, rawBytes: raw, textValue: text, name: TAGS[tag] || ("tag-" + tag) });
      i += length;
    }
    return { fields, errors };
  }
  function finding(p) {
    return Object.assign({ layer: "qr", category: "qr", source: SRC, evidence: {}, suggested_action_ar: "راجع المصدر.", suggested_action_en: "Review the source.", auto_fix_available: false }, p);
  }
  function inspectQr(raw) {
    const dec = b64(raw);
    if (!dec.ok) {
      return { artifact: { fields: [], errors: [dec.error] }, status: "FAILED", findings: [finding({ id: "QR-INVALID", severity: "error", status: "FAILED", title_ar: "الرمز غير صالح", title_en: "QR is invalid", message_ar: dec.error, message_en: dec.error })] };
    }
    const tlv = parseTlv(dec.bytes);
    const findings = [];
    if (tlv.errors.length) {
      findings.push(finding({ id: "QR-TLV-TRUNCATED", severity: "error", status: "FAILED", title_ar: "TLV ناقص", title_en: "TLV truncated", message_ar: tlv.errors.join(","), message_en: tlv.errors.join(",") }));
      return { artifact: { fields: tlv.fields, errors: tlv.errors }, status: "FAILED", findings };
    }
    findings.push(finding({ id: "QR-TLV-OK", severity: "info", status: "PASS_LOCAL_RULES", title_ar: "بنية TLV مقبولة", title_en: "Local TLV acceptable", message_ar: "فحص بنيوي محلي وليس اعتمادًا.", message_en: "Local structural check, not an approval." }));
    return { artifact: { fields: tlv.fields, errors: [] }, status: "PASS_LOCAL_RULES", findings };
  }
  function inspectXml(text) {
    const findings = [];
    if (/<!DOCTYPE/i.test(text) || /<!ENTITY/i.test(text)) {
      findings.push(finding({ id: "XML-UNSAFE", layer: "file", severity: "error", status: "FAILED", title_ar: "رُفض الملف", title_en: "File rejected", message_ar: "DOCTYPE/كيانات ممنوعة.", message_en: "DOCTYPE/entities rejected." }));
      return { artifact: { rejected: true, wellFormed: false }, status: "FAILED", findings };
    }
    if (!text.trim().startsWith("<")) {
      findings.push(finding({ id: "XML-NOT-XML", layer: "xml", severity: "error", status: "FAILED", title_ar: "ليس XML", title_en: "Not XML", message_ar: "النص لا يبدأ بـ <.", message_en: "Text does not start with <." }));
      return { artifact: { rejected: true, wellFormed: false }, status: "FAILED", findings };
    }
    findings.push(finding({ id: "XML-PREFLIGHT-OK", layer: "xml", severity: "info", status: "PASS_LOCAL_RULES", title_ar: "اجتاز الفحص البنيوي", title_en: "Structural preflight passed", message_ar: "ليس XSD وليس Schematron.", message_en: "Not XSD or Schematron." }));
    findings.push(finding({ id: "XSD-NOT-CHECKED", layer: "xsd", severity: "info", status: "NOT_CHECKED", title_ar: "XSD غير مفحوص", title_en: "XSD not checked", message_ar: "المخططات غير مضمّنة.", message_en: "Schemas are not bundled." }));
    return { artifact: { rejected: false, wellFormed: true }, status: "PASS_LOCAL_RULES", findings };
  }
  function rollup(layers) {
    const st = layers.map((l) => l.status);
    if (st.includes("FAILED")) return "FAILED";
    if (st.includes("INCONCLUSIVE") || st.includes("NOT_CHECKED")) return "INCONCLUSIVE";
    if (st.every((s) => s === "PASS_LOCAL_RULES" || s === "NOT_APPLICABLE")) return "PASS_LOCAL_RULES";
    return "INCONCLUSIVE";
  }
  function validateSession(input) {
    const layers = []; const findings = [];
    let qr, xml;
    if (input.qrBase64) {
      const r = inspectQr(input.qrBase64); qr = r.artifact; findings.push.apply(findings, r.findings);
      layers.push({ layer: "qr", status: r.status, checked: true });
    }
    if (input.xmlText) {
      const r = inspectXml(input.xmlText); xml = r.artifact; findings.push.apply(findings, r.findings);
      layers.push({ layer: xml && xml.rejected ? "file" : "xml", status: r.status, checked: true });
    }
    layers.push({ layer: "xsd", status: "NOT_CHECKED", checked: false });
    layers.push({ layer: "crypto", status: "INCONCLUSIVE", checked: false });
    const overall = rollup(layers);
    return {
      id: "web-" + Date.now(), created_at: new Date().toISOString(), app_version: "0.1.0-beta",
      ruleset: { id: "zatca-2023-05-19", version: "2023-05-19", qr_base64_max: 700 },
      inputs: { qr: !!input.qrBase64, xml: !!input.xmlText }, layers, findings, overall_status: overall,
      disclaimer_ar: DISCLAIMER_AR, disclaimer_en: DISCLAIMER_EN, qr, xml
    };
  }
  root.KhatmEngine = { DISCLAIMER_AR, DISCLAIMER_EN, SAMPLE, TAGS, inspectQr, inspectXml, validateSession, STATUS_AR: { PASS_LOCAL_RULES: "قواعد محلية", FAILED: "فشل", INCONCLUSIVE: "غير حاسم", NOT_CHECKED: "لم يُفحص" } };
})(typeof window !== "undefined" ? window : globalThis);
