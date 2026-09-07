import type { ResultStatus, ValidationFinding, XMLArtifact } from "../../shared-types/src/index.ts";

const SOURCE = {
  document: "Khatm Invoice file-layer policy + ZATCA XML Implementation Standard v1.2 (structure only)",
  rule_reference: "Well-formed XML / no DTD",
  url: "https://zatca.gov.sa/ar/E-Invoicing/SystemsDevelopers/Documents/20230519_ZATCA_Electronic_Invoice_XML_Implementation_Standard_%20vF.pdf",
  ruleset_version: "2023-05-19",
  published_date: "2023-05-19",
};

const XML_MAX_BYTES = 2 * 1024 * 1024;

export function parseXmlSafe(xmlText: string, fileName?: string): XMLArtifact {
  const text = xmlText ?? "";
  const artifact: XMLArtifact = { fileName, wellFormed: false, rejected: false, namespaces: {}, textExcerpt: text.slice(0, 240) };
  if (text.length > XML_MAX_BYTES) {
    artifact.rejected = true;
    artifact.rejectReason = "oversize";
    return artifact;
  }
  if (text.includes("\0")) {
    artifact.rejected = true;
    artifact.rejectReason = "binary";
    return artifact;
  }
  if (
    /<!DOCTYPE/i.test(text) ||
    /<!ENTITY/i.test(text) ||
    /<!ELEMENT/i.test(text) ||
    /<!ATTLIST/i.test(text) ||
    /SYSTEM\s+["']|PUBLIC\s+["']/.test(text) ||
    /xi:include|xinclude/i.test(text) ||
    /<\?xml-stylesheet/i.test(text)
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
  const nsRe = /xmlns(?::([A-Za-z_][\w.-]*))?=["']([^"']+)["']/g;
  let m: RegExpExecArray | null;
  while ((m = nsRe.exec(text))) artifact.namespaces[m[1] || "xmlns"] = m[2];
  const root = trimmed.match(/^<\?xml[^>]*\?>\s*<([A-Za-z_][\w:.-]*)/) || trimmed.match(/^<([A-Za-z_][\w:.-]*)/);
  if (root) artifact.rootLocalName = root[1].split(":").pop();
  if (!artifact.rootLocalName) {
    artifact.rejected = true;
    artifact.rejectReason = "not-xml";
    return artifact;
  }
  const closer = new RegExp("<\\/(?:[\\w.-]+:)?" + artifact.rootLocalName + "\\s*>", "i");
  if (!closer.test(trimmed) && !/\/>\s*$/.test(trimmed)) {
    artifact.wellFormed = false;
    return artifact;
  }
  artifact.sellerName = text.match(/cbc:RegistrationName[^>]*>([^<]+)/)?.[1] ?? null;
  artifact.vatNumber = text.match(/cbc:CompanyID[^>]*>([^<]+)/)?.[1] ?? null;
  artifact.payableAmount = text.match(/cbc:PayableAmount[^>]*>([^<]+)/)?.[1]
    ?? text.match(/cbc:TaxInclusiveAmount[^>]*>([^<]+)/)?.[1]
    ?? null;
  artifact.taxInclusiveAmount = text.match(/cbc:TaxInclusiveAmount[^>]*>([^<]+)/)?.[1] ?? null;
  artifact.taxAmount = text.match(/cbc:TaxAmount[^>]*>([^<]+)/)?.[1] ?? null;
  artifact.invoiceId = text.match(/cbc:ID[^>]*>([^<]+)/)?.[1] ?? null;
  artifact.issueDateTime = text.match(/cbc:IssueDate[^>]*>([^<]+)/)?.[1] ?? null;
  artifact.wellFormed = Boolean(artifact.rootLocalName);
  return artifact;
}

export function inspectXmlFile(xmlText: string, fileName?: string): { artifact: XMLArtifact; findings: ValidationFinding[]; status: ResultStatus } {
  const artifact = parseXmlSafe(xmlText, fileName);
  const findings: ValidationFinding[] = [];
  const base = { layer: "xml" as const, category: "xml", source: SOURCE, evidence: {}, suggested_action_ar: "راجع الملف.", suggested_action_en: "Review the file.", auto_fix_available: false };
  if (artifact.rejected) {
    findings.push({
      ...base,
      id: artifact.rejectReason === "oversize" ? "XML-OVERSIZE" : artifact.rejectReason === "not-xml" ? "XML-NOT-WELL-FORMED" : "XML-UNSAFE-PREFLIGHT",
      layer: "file",
      severity: "error",
      status: "FAILED",
      title_ar: artifact.rejectReason === "oversize" ? "الملف أكبر من حد الفحص" : "رُفض الملف قبل التحليل",
      title_en: artifact.rejectReason === "oversize" ? "File exceeds 2 MiB cap" : "File rejected before parsing",
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
