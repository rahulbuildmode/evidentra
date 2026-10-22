export type Classification =
  | "Not yet classified"
  | "Class A"
  | "Class B"
  | "Class C"
  | "Class D";

export interface FieldValue {
  value: string;
  /** True only when the user has confirmed this value against an official/source document. */
  verified: boolean;
}

export type WorkspaceFieldKey =
  | "deviceName"
  | "manufacturer"
  | "modelNumber"
  | "intendedUse"
  | "classification"
  | "pathway";

export type Workspace = Record<WorkspaceFieldKey, FieldValue>;

export type DocumentSource = "demo" | "upload";

export interface DocumentRecord {
  id: string;
  filename: string;
  title: string;
  source: DocumentSource;
  pages: number | null;
  sizeBytes: number | null;
  addedAt: string;
  /** Demo documents are fictional; uploads are not analysed until AI extraction is enabled. */
  status: "demo-seeded" | "uploaded-not-analysed";
}

export type FactField =
  | "manufacturer_name"
  | "device_name"
  | "model_number"
  | "certificate_number"
  | "certificate_expiry_date";

export interface Fact {
  id: string;
  documentId: string;
  field: FactField;
  value: string;
  quote: string;
  filename: string;
  page: number;
  source: DocumentSource;
}

export type EvidenceStatus = "found" | "partial" | "not_found";

export interface EvidenceLink {
  requirementId: string;
  suggestedStatus: EvidenceStatus;
  filename?: string;
  page?: number;
  quote?: string;
  note: string;
}

export type Decision = "undecided" | "approved" | "rejected";

export interface AppState {
  isDemo: boolean;
  workspace: Workspace;
  documents: DocumentRecord[];
  facts: Fact[];
  evidence: EvidenceLink[];
  decisions: Record<string, Decision>;
}

export type Severity = "fail" | "warn" | "info";

export interface Finding {
  id: string;
  check: string;
  severity: Severity;
  title: string;
  detail: string;
  citations: { filename: string; page: number; quote: string }[];
}

export interface Requirement {
  id: string;
  title: string;
  description: string;
  sourceName: string;
  sourceUrl: string;
  /** Always false until a human checks it against the official text. */
  verifiedAgainstOfficialText: boolean;
}
