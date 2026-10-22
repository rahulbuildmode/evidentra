/**
 * Run trace types (shared by client and server). A run is one execution of the analysis pipeline.
 * Every timestamp and duration is recorded on the server at the point of execution; nothing here
 * is estimated by the browser.
 */

export const STEP_KEYS = ["documents", "extraction", "ai_analysis", "verification", "checks", "ai_mapping", "validation", "save"] as const;
export type StepKey = (typeof STEP_KEYS)[number];

export const STEP_LABEL: Record<StepKey, string> = {
  documents: "Upload and validation",
  extraction: "Text extraction",
  ai_analysis: "AI request 1 — read and compare",
  verification: "Quote verification",
  checks: "Deterministic consistency checks",
  ai_mapping: "AI request 2 — match evidence to CDSCO requirements",
  validation: "CDSCO requirement validation (code)",
  save: "Report data saved",
};

export type StepStatus = "pending" | "running" | "completed" | "failed" | "skipped";

export interface StepRecord {
  key: StepKey;
  status: StepStatus;
  startedAt: string | null;
  endedAt: string | null;
  /** Measured with a monotonic clock on the server. */
  durationMs: number | null;
  /** Why the step was skipped or failed (safe, user-facing). */
  note: string | null;
}

export type RunEventType =
  | "run_started"
  | "step_started"
  | "step_completed"
  | "step_failed"
  | "step_skipped"
  | "document_processed"
  | "document_skipped"
  | "ai_request_started"
  | "ai_attempt"
  | "run_completed"
  | "run_failed";

export interface RunEvent {
  seq: number;
  runId: string;
  type: RunEventType;
  at: string;
  step?: StepKey;
  message?: string;
  data?: Record<string, unknown>;
}

export interface DocumentOutcome {
  id: string;
  filename: string;
  status: "extracted" | "needs_ocr" | "failed";
  pages: number | null;
  /** Server-measured extraction time at upload; null for documents uploaded before this was recorded. */
  extractMs: number | null;
  uploadedAt: string;
  included: boolean;
  reason: string | null;
  charsSent?: number;
  truncated?: boolean;
}

/** One network request to Gemini (retries are separate attempts). */
export interface AiAttempt {
  stage: "analysis" | "mapping";
  attempt: number;
  startedAt: string;
  durationMs: number;
  outcome: "ok" | "unusable_output" | "overloaded_retry" | "error";
  httpStatus: number | null;
  note: string | null;
  promptTokens: number | null;
  outputTokens: number | null;
}

export interface AiStageRecord {
  stage: "analysis" | "mapping";
  model: string;
  attempts: AiAttempt[];
  /** The model's validated output as returned (the original proposal), or null if it failed. */
  output: unknown | null;
  errorCode: string | null;
}

export interface CheckRecord {
  id: string;
  check: string;
  field: string;
  /** What was compared (values as stated in the documents). */
  compared: { value: string; filename: string; page: number }[];
  outcome: "consistent" | "differs" | "format_only" | "passed" | "warning" | "failed";
  detail: string;
}

export interface QuoteRecord {
  source: "analysis" | "mapping";
  /** Finding/fact/requirement the quote belongs to. */
  context: string;
  quote: string;
  proposedFilename: string;
  proposedPage: number | null;
  check: "verified" | "verified_other_page" | "not_found" | "unknown_file";
  verifiedPage: number | null;
}

export interface RunRecord {
  runId: string;
  workspaceId: string;
  kind: "live" | "demo-seed";
  status: "running" | "completed" | "failed";
  startedAt: string;
  endedAt: string | null;
  durationMs: number | null;
  requirementSetId: string | null;
  steps: StepRecord[];
  events: RunEvent[];
  documents: DocumentOutcome[];
  ai: AiStageRecord[];
  quotes: QuoteRecord[];
  checks: CheckRecord[];
  /** What the run produced, counted from the saved results (null if it stopped before producing any). */
  findings: {
    total: number;
    /** AI suggestions split by whether every quote verified, plus code-check flags. */
    byStatus: Record<string, number>;
    /** Final requirement statuses after code rules (null if mapping did not run). */
    requirements: Record<string, number> | null;
  } | null;
  failure: { step: StepKey; code: string; message: string } | null;
  /** Outcome of the CDSCO validation step (the full report is saved separately). */
  validation?: { pathway: string; decision: string; counts: Record<string, number> } | null;
}

export interface RunSummary {
  runId: string;
  kind: RunRecord["kind"];
  status: RunRecord["status"];
  startedAt: string;
  endedAt: string | null;
  durationMs: number | null;
}
