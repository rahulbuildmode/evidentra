/**
 * CDSCO regulatory validation: shared (client + server) types. No Node imports.
 *
 * Separation kept throughout:
 *  - official source text (verified excerpts of the Medical Devices Rules, 2017),
 *  - device profile facts entered/confirmed by a person,
 *  - AI-proposed interpretation (Gemini evidence matching),
 *  - code-verified evidence (quotations found in the extracted text, keyword locations),
 *  - deterministic checks (exact comparisons, dates),
 *  - human decisions.
 */

export type RiskClass = "A" | "B" | "C" | "D" | "unknown";
export type Tri = "yes" | "no" | "unknown";

export interface DeviceProfile {
  deviceName: string;
  intendedUse: string;
  manufacturer: string;
  /** Free text, e.g. "pulse oximeter". Never used to infer the risk class. */
  deviceCategory: string;
  riskClass: RiskClass;
  /** True only when a person confirmed the class against the official classification. */
  riskClassConfirmed: boolean;
  /** Where the class came from, in the person's words (e.g. "CDSCO classification list, entry …"). */
  riskClassBasis: string;
  activity: "manufacture" | "import" | "unknown";
  ivd: Tri;
  licenceType: "licence" | "loan_licence" | "unknown";
  /** Whether a test licence (Form MD-13) was obtained — Fourth Schedule Part II (ii)(e) says "if any". */
  testLicence: Tri;
  /** "demo" = the fictional demo profile. */
  origin: "user" | "demo";
  updatedAt: string | null;
}

export const EMPTY_PROFILE: DeviceProfile = {
  deviceName: "",
  intendedUse: "",
  manufacturer: "",
  deviceCategory: "",
  riskClass: "unknown",
  riskClassConfirmed: false,
  riskClassBasis: "",
  activity: "unknown",
  ivd: "unknown",
  licenceType: "unknown",
  testLicence: "unknown",
  origin: "user",
  updatedAt: null,
};

/** How a requirement is evaluated. */
export type Criterion =
  /** Gemini proposes which passage is relevant; code verifies every quotation. */
  | { kind: "evidence"; searchTerms: string[] }
  /** Plus exact identity comparison of verified facts (model number, device name, manufacturer). */
  | { kind: "evidence_and_identity"; searchTerms: string[]; identityFields: ("model_number" | "device_name" | "manufacturer_name")[] }
  /** Verified "valid until" dates must not be before today. */
  | { kind: "certificate_validity"; searchTerms: string[] }
  /** Only a person can decide (e.g. an interpretation question). */
  | { kind: "human_only" };

/** Conditions are evaluated by code against the device profile. Never by the language model. */
export type Applicability =
  | { kind: "always_in_pathway" }
  | { kind: "non_ivd_only" }
  | { kind: "ivd_only" }
  | { kind: "if_test_licence_obtained" }
  /** Listed only in the official Form MD-7 (Class C/D) checklist; no Class B checklist was verified. */
  | { kind: "md7_checklist_class_cd" }
  | { kind: "interpretation_required"; question: string };

export interface RegRequirement {
  id: string;
  title: string;
  /** Exact location in the official text. */
  reference: string;
  sourceTitle: string;
  sourceUrl: string;
  /** PDF page of the official file where the excerpt appears. */
  sourcePage: number;
  /** Verbatim excerpt from the official text (checked by tests against the stored page text). */
  excerpt: string;
  applicability: Applicability;
  evidenceNeeded: string;
  /** Plain-language, testable criterion. */
  criterionText: string;
  criterion: Criterion;
  notes: string;
  verification: { status: "verified" | "unverified"; lastChecked: string; method: string };
  nextActionIfMissing: string;
  /** Matching item in the official CDSCO Form MD-7 checklist (Class C/D), verified against its text. */
  checklist?: { item: string; text: string };
}

export interface Pathway {
  id: string;
  name: string;
  libraryVersion: string;
  lastReviewed: string;
  source: { title: string; url: string; version: string; sha256: string };
  checklistSource: { title: string; url: string; sha256: string; pdfCreated: string; appliesTo: RiskClass[] };
  scope: string;
  notCovered: string[];
  /** Rule-level basis for the pathway itself (application form and authority by class). */
  basis: { classes: RiskClass[]; form: string; authority: string; reference: string; sourcePage: number; excerpt: string }[];
  requirements: RegRequirement[];
}

export type ApplicabilityDecision = "applicable" | "not_applicable" | "unresolved";

export const VALIDATION_STATUS = [
  "conflict_detected",
  "potential_gap",
  "needs_human_review",
  "evidence_found",
  "validated_against_source",
  "not_applicable",
] as const;
export type ValidationStatus = (typeof VALIDATION_STATUS)[number];

export const VALIDATION_LABEL: Record<ValidationStatus, string> = {
  evidence_found: "Evidence found",
  potential_gap: "Potential gap",
  conflict_detected: "Conflict detected",
  needs_human_review: "Needs human review",
  not_applicable: "Not applicable",
  validated_against_source: "Validated against source",
};

export const VALIDATION_MEANING: Record<ValidationStatus, string> = {
  evidence_found: "Relevant text was located and verified. This does not prove the requirement is satisfied.",
  potential_gap: "Expected evidence was not located in the documents reviewed. Not proof that it is missing.",
  conflict_detected: "Documents contain an inconsistency supported by actual source passages.",
  needs_human_review: "Applicability, interpretation or sufficiency of evidence is uncertain.",
  not_applicable: "Excluded by an explicit, recorded applicability decision.",
  validated_against_source: "This specific check was evaluated by code against verified text. It is not a compliance decision.",
};

export interface EvidenceItem {
  kind: "ai_quote" | "keyword" | "deterministic";
  /** ai_quote: the AI proposed this passage; code checked it. keyword: code located the term. deterministic: exact check. */
  filename: string;
  page: number | null;
  proposedPage?: number | null;
  text: string;
  check?: "verified" | "verified_other_page" | "not_found" | "unknown_file";
  /** The source document is part of the fictional demo dossier. */
  synthetic: boolean;
  value?: string;
}

export interface RequirementResult {
  requirementId: string;
  title: string;
  reference: string;
  sourceUrl: string;
  sourcePage: number;
  excerpt: string;
  sourceTitle: string;
  sourceVerified: boolean;
  /** Shown when the official Form MD-7 checklist applies (Class C/D). */
  checklist: { item: string; text: string; url: string } | null;
  applicability: { decision: ApplicabilityDecision; rationale: string; conditional: boolean };
  status: ValidationStatus;
  explanation: string;
  /** What was searched (documents, pages, terms) — always shown for gaps. */
  searched: string;
  ai: { proposedStatus: string | null; rationale: string | null; source: "gemini" | "demo-seed" | null } | null;
  evidence: EvidenceItem[];
  deterministic: { check: string; outcome: "passed" | "failed" | "not_evaluable"; detail: string }[];
  nextAction: string;
  humanReviewRequired: boolean;
}

export interface PathwayDecision {
  status: "in_scope" | "unresolved" | "out_of_scope";
  label: string;
  form: string | null;
  authority: string | null;
  reasons: string[];
  unknownFields: string[];
}

export interface ValidationReport {
  generatedAt: string;
  today: string;
  workspaceId: string;
  synthetic: boolean;
  pathway: { id: string; name: string; libraryVersion: string; lastReviewed: string; source: Pathway["source"]; scope: string; notCovered: string[] };
  profile: DeviceProfile;
  decision: PathwayDecision;
  inputs: {
    analysis: { runId: string; source: string; createdAt: string; model: string } | null;
    mapping: { runId: string; source: string; createdAt: string; model: string | null; stale: boolean } | null;
    documentsReviewed: { filename: string; pages: number; synthetic: boolean }[];
    documentsSkipped: { filename: string; reason: string }[];
  };
  results: RequirementResult[];
  counts: Record<ValidationStatus, number>;
  actions: { requirementId: string; title: string; status: ValidationStatus; action: string }[];
  unresolved: { item: string; why: string }[];
  limitations: string[];
}
