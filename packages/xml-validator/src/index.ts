import type { ResultStatus, ValidationFinding, XMLArtifact } from "../../shared-types/src/index.ts";

const SOURCE = {
  document: "Khatm Invoice file-layer policy + ZATCA XML Implementation Standard v1.2 (structure only)",
  rule_reference: "Well-formed XML / no DTD",
  url: "https://zatca.gov.sa/ar/E-Invoicing/SystemsDevelopers/Documents/20230519_ZATCA_Electronic_Invoice_XML_Implementation_Standard_%20vF.pdf",
  ruleset_version: "2023-05-19",
  published_date: "2023-05-19",
};

const XML_MAX_BYTES = 2 * 1024 * 1024;
const ALLOWED_ROOTS = new Set(["Invoice", "CreditNote", "DebitNote"]);
const HOSTILE = {
  dtd: /<!DOCTYPE/i,
  entity: /<!ENTITY/i,
  element: /<!ELEMENT/i,
  attlist: /<!ATTLIST/i,
  extid: /SYSTEM\s+["']|PUBLIC\s+["']/, 
  xinclude: /xi:include|xinclude/i,
  stylesheet: /<\?xml-stylesheet/i,
  php: /<\?(?!xml\b)/i,
  uri: /(?:file|php|expect|jar|netdoc|javascript|data):/i,
  html: /<(?:html|script)\b/i,
  utf7: /encoding\s*=\s*["']?utf-7/i,
};

function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

function firstLocal(text: string, localName: string): string | null {
  const re = new RegExp(`<(?:[\\w]+:)?${localName}[^>]*>([^<]+)`);
  return text.match(re)?.[1] ?? null;
}

function taxTotalAmount(text: string): string | null {
  const block = text.match(/<(?:[\w]+:)?TaxTotal\b[\s\S]*?<\/(?:[\w]+:)?TaxTotal>/i);
  if (!block) return null;
  return firstLocal(block[0], "TaxAmount");
}

export function parseXmlSafe(xmlText: string, fileName?: string): XMLArtifact {
  const text = stripBom(xmlText ?? "");
  const artifact: XMLArtifact = { fileName, wellFormed: false, rejected: false, namespaces: {}, textExcerpt: text.slice(0, 240) };
  if (text.length > XML_MAX_BYTES) {
    artifact.rejected = true;
    artifact.rejectReason = "oversize";
    return artifact;
  }
  if (text.includes("\0") || /[\x01-\x08\x0B\x0C\x0E-\x1F]/.test(text)) {
    artifact.rejected = true;
    artifact.rejectReason = "binary";
    return artifact;
  }
  if (text.includes("<!--") && !text.includes("-->")) {
    artifact.rejected = true;
    artifact.rejectReason = "dtd-or-entity";
    return artifact;
  }
  if (
    HOSTILE.dtd.test(text) ||
    HOSTILE.entity.test(text) ||
    HOSTILE.element.test(text) ||
    HOSTILE.attlist.test(text) ||
    HOSTILE.extid.test(text) ||
    HOSTILE.xinclude.test(text) ||
    HOSTILE.stylesheet.test(text) ||
    HOSTILE.php.test(text) ||
    HOSTILE.uri.test(text) ||
    HOSTILE.html.test(text) ||
    HOSTILE.utf7.test(text)
  ) {
    artifact.rejected = true;
    artifact.rejectReason = "dtd-or-entity";
    return artifact;
  }
  const trimmed = text.trim();
  if (!trimmed.startsWith("<")) {
    artifact.rejected = true;
    artifact.rejectReason = "not-xml";
    return artifact;
  }
  const nsRe = /xmlns(?::([A-Za-z_][\w.-]*))?=["]([^"']+)["]/g;
  let m: RegExpExecArray | null;
  while ((m = nsRe.exec(text))) artifact.namespaces[m[1] || "xmlns"] = m[2];
  const root = trimmed.match(/^<\?xml[^>]*\?>\s*<([A-Za-z_][\w:.-]*)/) || trimmed.match(/^<([A-Za-z_][\w:.-]*)/);
  if (root) artifact.rootLocalName = root[1].split(":").pop();
  if (!artifact.rootLocalName) {
    artifact.rejected = true;
    artifact.rejectReason = "not-xml";
    return artifact;
  }
  if (!ALLOWED_ROOTS.has(artifact.rootLocalName)) {
    artifact.rejected = true;
    artifact.rejectReason = "wrong-root";
    return artifact;
  }
  const closer = new RegExp("<\\/(?:[\\w.-]+:)?" + artifact.rootLocalName + "\\s*>", "i");
  const closeMatch = trimmed.match(closer);
  if (!closeMatch && !/\/>\s*$/.test(trimmed)) {
    artifact.wellFormed = false;
    return artifact;
  }
  if (closeMatch) {
    const after = trimmed.slice((closeMatch.index ?? 0) + closeMatch[0].length).trim();
    if (after) {
      artifact.rejected = true;
      artifact.rejectReason = "trailing-junk";
      return artifact;
    }
  }
  artifact.sellerName = firstLocal(text, "RegistrationName");
  artifact.vatNumber = firstLocal(text, "CompanyID");
  artifact.payableAmount = firstLocal(text, "PayableAmount") ?? firstLocal(text, "TaxInclusiveAmount");
  artifact.taxInclusiveAmount = firstLocal(text, "TaxInclusiveAmount");
  artifact.taxAmount = taxTotalAmount(text) ?? firstLocal(text, "TaxAmount");
  artifact.invoiceId = firstLocal(text, "ID");
  artifact.issueDateTime = firstLocal(text, "IssueDate");
  artifact.wellFormed = Boolean(artifact.rootLocalName);
  return artifact;
}

export function inspectXmlFile(xmlText: string, fileName?: string): { artifact: XMLArtifact; findings: ValidationFinding[]; status: ResultStatus } {
  const artifact = parseXmlSafe(xmlText, fileName);
  const findings: ValidationFinding[] = [];
  const base = { layer: "xml" as const, category: "xml", source: SOURCE, evidence: {}, suggested_action_ar: "راجع الملف.", suggested_action_en: "Review the file.", auto_fix_available: false };
  if (artifact.rejected) {
    const id = artifact.rejectReason === "oversize"
      ? "XML-OVERSIZE"
      : artifact.rejectReason === "not-xml" || artifact.rejectReason === "wrong-root" || artifact.rejectReason === "trailing-junk"
        ? "XML-NOT-WELL-FORMED"
        : "XML-UNSAFE-PREFLIGHT";
    findings.push({
      ...base,
      id,
      layer: artifact.rejectReason === "oversize" || artifact.rejectReason === "dtd-or-entity" || artifact.rejectReason === "binary" ? "file" : "xml",
      severity: "error",
      status: "FAILED",
      title_ar: artifact.rejectReason === "oversize" ? "الملف أكبر من حد الفحص" : artifact.rejectReason === "wrong-root" ? "جذر الملف ليس فاتورة" : "رُفض الملف قبل التحليل",
      title_en: artifact.rejectReason === "oversize" ? "File exceeds 2 MiB cap" : artifact.rejectReason === "wrong-root" ? "Root is not an invoice document" : "File rejected before parsing",
      message_ar: String(artifact.rejectReason),
      message_en: String(artifact.rejectReason),
    });
    return { artifact, findings, status: "FAILED" };
  }
  if (!artifact.wellFormed) {
    findings.push({
      ...base,
      id: "XML-NOT-WELL-FORMED",
      severity: "error",
      status: "FAILED",
      title_ar: "النص ليس XML صالح البنية",
      title_en: "Text is not well-formed XML",
      message_ar: "تعذر تحديد عنصر الجذر.",
      message_en: "Root element missing.",
    });
    return { artifact, findings, status: "FAILED" };
  }
  findings.push({
    ...base,
    id: "XML-PREFLIGHT-OK",
    severity: "info",
    status: "PASS_LOCAL_RULES",
    title_ar: "اجتاز الفحص البنيوي — XSD غير مفحوص",
    title_en: "Local well-formed check passed — XSD not run",
    message_ar: "ليس فحص XSD أو Schematron.",
    message_en: "Not XSD or Schematron validation.",
  });
  return { artifact, findings, status: "PASS_LOCAL_RULES" };
}
