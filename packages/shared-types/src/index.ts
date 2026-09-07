export type ResultStatus =
  | "PASS_LOCAL_RULES"
  | "PASS_OFFICIAL_SDK"
  | "FAILED"
  | "WARNING"
  | "INCONCLUSIVE"
  | "NOT_CHECKED"
  | "NOT_APPLICABLE"
  | "UNSUPPORTED_RULESET";

export type Severity = "error" | "warning" | "info";
export type Layer =
  | "file"
  | "qr"
  | "xml"
  | "xsd"
  | "schematron"
  | "business"
  | "crypto"
  | "cross"
  | "sdk";

export interface RuleSource {
  document: string;
  rule_reference: string;
  url: string;
  ruleset_version: string;
  published_date?: string;
}

export interface TlvField {
  tag: number;
  length: number;
  rawBytes?: number[];
  rawHex: string;
  textValue: string | null;
  name_ar?: string;
  name_en?: string;
}

export interface QRArtifact {
  rawBase64: string;
  byteLength: number;
  fields: TlvField[];
  errors: string[];
}

export interface XMLArtifact {
  fileName?: string;
  wellFormed: boolean;
  rejected: boolean;
  rejectReason?: string;
  namespaces: Record<string, string>;
  rootLocalName?: string;
  textExcerpt?: string;
  sellerName?: string | null;
  vatNumber?: string | null;
  issueDateTime?: string | null;
  payableAmount?: string | null;
  taxInclusiveAmount?: string | null;
  taxAmount?: string | null;
  invoiceId?: string | null;
  uuid?: string | null;
}

export interface ValidationFinding {
  id: string;
  layer: Layer;
  severity: Severity;
  category: string;
  status: ResultStatus;
  title_ar: string;
  title_en: string;
  message_ar: string;
  message_en: string;
  source: RuleSource;
  evidence: Record<string, unknown>;
  suggested_action_ar: string;
  suggested_action_en: string;
  auto_fix_available: boolean;
}

export interface LayerResult {
  layer: Layer;
  status: ResultStatus;
  checked: boolean;
  findings: ValidationFinding[];
}

export interface RulesetInfo {
  id: string;
  version: string;
  published_date: string;
  qr_base64_max: number;
}

export interface ValidationSession {
  id: string;
  created_at: string;
  app_version: string;
  ruleset: RulesetInfo;
  invoice_type: "standard" | "simplified" | "unknown";
  inputs: { qr: boolean; xml: boolean };
  layers: LayerResult[];
  findings: ValidationFinding[];
  overall_status: ResultStatus;
  disclaimer_ar: string;
  disclaimer_en: string;
  qr?: QRArtifact;
  xml?: XMLArtifact;
}

export const DISCLAIMER_AR =
  "اجتازت الفاتورة القواعد المحلية المتاحة في إصدار القواعد المذكور. هذا فحص تقني مستقل وليس اعتمادًا من هيئة الزكاة والضريبة والجمارك.";
export const DISCLAIMER_EN =
  "The invoice passed the local rules available in the cited ruleset version. This is an independent technical inspection and is not an approval by the Zakat, Tax and Customs Authority.";
