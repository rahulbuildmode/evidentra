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

export interface AppState {
  /** Uploads and AI results on the server are stored per workspace id. */
  workspaceId: string;
  isDemo: boolean;
  workspace: Workspace;
  /** Which requirement set the Evidence Matrix maps against. */
  requirementSetId: string;
}

export type Severity = "fail" | "warn" | "info";

export interface FindingCitation {
  filename: string;
  page: number;
  quote: string;
  /** The value this passage states (for conflicting-value findings). */
  value?: string;
}

/** A deterministic (plain-code) consistency finding. */
export interface Finding {
  id: string;
  check: string;
  severity: Severity;
  title: string;
  detail: string;
  citations: FindingCitation[];
}
