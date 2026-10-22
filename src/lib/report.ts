import type { AnalysisResult, CheckedCitation } from "./analysis";
import { crossCheck } from "./checks";
import { EVIDENCE_LABEL, EVIDENCE_STATUS, type EvidenceStatus, type MappingResult } from "./mapping";
import { scenarioApplicability, type Requirement, type RequirementSet } from "./requirements";
import {
  aiItemKey,
  changedSinceReview,
  codeFindingKey,
  EMPTY_REVIEW,
  fingerprint,
  requirementKey,
  type FindingStatus,
  type Review,
} from "./review";
import type { AppState, WorkspaceFieldKey } from "./types";
import type { UploadedDocumentMeta } from "./uploads";

/**
 * Builds the pre-submission gap report from live application state. Every number in the
 * report is computed here from the evidence mapping, analysis, uploads and human reviews.
 */

/** Where an item came from — always shown, so readers can tell these apart. */
export type Provenance = "official" | "synthetic" | "ai" | "demo-seed" | "code";
export const PROVENANCE_LABEL: Record<Provenance, string> = {
  official: "Official requirement (verified text)",
  synthetic: "Synthetic demo item",
  ai: "AI suggestion",
  "demo-seed": "Demo seed (hand-written)",
  code: "Code check",
};

export interface ReportCitation {
  filename: string;
  page: number | null;
  quote: string;
  verified: boolean;
  value?: string;
}

interface Reviewable {
  key: string;
  basis: string;
  review: Review;
  dismissed: boolean;
  humanReviewed: boolean;
  changedSinceReview: boolean;
}

export interface RequirementRow extends Reviewable {
  requirement: Requirement;
  requirementProvenance: "official" | "synthetic";
  evidenceProvenance: "ai" | "demo-seed" | null;
  proposedStatus: EvidenceStatus | null;
  effectiveStatus: EvidenceStatus | "not_assessed";
  overridden: boolean;
  rationale: string;
  nextAction: string;
  codeNote: string | null;
  citations: ReportCitation[];
}

export type DiscrepancyGroup = "discrepancy" | "missing_info";

export interface ReportFinding extends Reviewable {
  group: DiscrepancyGroup;
  provenance: "code" | "ai" | "demo-seed";
  severity: "high" | "medium" | "low";
  title: string;
  detail: string;
  values: string[];
  citations: ReportCitation[];
  effectiveStatus: FindingStatus;
}

export interface ReportAction {
  id: string;
  priority: 1 | 2 | 3;
  title: string;
  action: string;
  reason: string;
  itemKey: string;
  provenance: Provenance;
  citations: ReportCitation[];
  reviewState: string;
}

export interface ApplicabilityQuestion {
  id: string;
  question: string;
  why: string;
}

export interface GapReport {
  generatedFor: string;
  isDemo: boolean;
  set: RequirementSet;
  applicability: ReturnType<typeof scenarioApplicability>;
  mapping: MappingResult | null;
  analysis: AnalysisResult | null;
  documents: { total: number; usable: number; unusable: UploadedDocumentMeta[] };
  requirements: RequirementRow[];
  findings: ReportFinding[];
  questions: ApplicabilityQuestion[];
  actions: ReportAction[];
  awaitingReview: (RequirementRow | ReportFinding)[];
  counts: {
    evidence: Record<EvidenceStatus | "not_assessed", number>;
    discrepanciesOpen: number;
    discrepanciesConfirmed: number;
    discrepanciesResolved: number;
    missingInfoOpen: number;
    dismissed: number;
    awaitingReview: number;
    reviewed: number;
    changedSinceReview: number;
    unverifiedWorkspaceFields: number;
  };
}

const toCite = (c: CheckedCitation): ReportCitation => ({
  filename: c.filename,
  page: c.verifiedPage ?? c.claimedPage,
  quote: c.quote,
  verified: c.verifiedPage !== null,
});

/** Fingerprints of what a reviewer saw — shared by the report and the other pages. */
export const requirementBasis = (row: { status: string; citations: { quote: string }[] } | null) =>
  fingerprint([row?.status ?? "not_assessed", ...(row?.citations ?? []).map((c) => c.quote)]);
export const codeFindingBasis = (f: { title: string; detail: string }) => fingerprint([f.title, f.detail]);
export const aiItemBasis = (it: { value: string; citations: { quote: string }[] }) =>
  fingerprint([it.value, ...it.citations.map((c) => c.quote)]);

function reviewable(key: string, basis: string, reviews: Record<string, Review>): Reviewable {
  const review = reviews[key] ?? EMPTY_REVIEW;
  return {
    key,
    basis,
    review,
    dismissed: Boolean(review.dismissedReason),
    humanReviewed: review.reviewed,
    changedSinceReview: changedSinceReview(reviews[key], basis),
  };
}

const WORKSPACE_LABELS: Record<WorkspaceFieldKey, string> = {
  deviceName: "Device name",
  manufacturer: "Manufacturer",
  modelNumber: "Model number",
  intendedUse: "Intended use",
  classification: "Classification",
  pathway: "Regulatory pathway",
};

export function buildReport(input: {
  state: AppState;
  set: RequirementSet;
  mapping: MappingResult | null;
  analysis: AnalysisResult | null;
  uploads: UploadedDocumentMeta[];
  reviews: Record<string, Review>;
  today: string | null;
}): GapReport {
  const { state, set, analysis, uploads, reviews, today } = input;
  const mapping = input.mapping && input.mapping.requirementSetId === set.id ? input.mapping : null;
  const applicability = scenarioApplicability(set, state.workspace);
  const reqProv = set.verification === "official_text" ? "official" : "synthetic";

  // ---- Requirements (evidence matrix) ----
  const requirements: RequirementRow[] = set.requirements.map((req) => {
    const row = mapping?.rows.find((r) => r.requirementId === req.id) ?? null;
    const citations = (row?.citations ?? []).map(toCite);
    const key = requirementKey(set.id, req.id);
    const basis = requirementBasis(row);
    const rv = reviewable(key, basis, reviews);
    const override = rv.review.status && (EVIDENCE_STATUS as readonly string[]).includes(rv.review.status)
      ? (rv.review.status as EvidenceStatus)
      : null;
    return {
      ...rv,
      requirement: req,
      requirementProvenance: reqProv,
      evidenceProvenance: mapping ? mapping.source === "demo-seed" ? "demo-seed" : "ai" : null,
      proposedStatus: row?.status ?? null,
      effectiveStatus: override ?? row?.status ?? "not_assessed",
      overridden: Boolean(override && override !== row?.status),
      rationale: row?.rationale ?? "",
      nextAction: row?.nextAction ?? "",
      codeNote: row?.codeNote ?? null,
      citations,
    };
  });

  // ---- Findings: deterministic discrepancies, AI semantic discrepancies, AI missing info ----
  const findings: ReportFinding[] = [];
  const aiProv = analysis?.source === "demo-seed" ? "demo-seed" : "ai";
  const statusOf = (r: Review): FindingStatus =>
    r.status === "confirmed" || r.status === "resolved" ? r.status : "open";

  for (const f of crossCheck(analysis, state.workspace, today)) {
    const key = codeFindingKey(f.id);
    const basis = codeFindingBasis(f);
    const rv = reviewable(key, basis, reviews);
    findings.push({
      ...rv,
      group: "discrepancy",
      provenance: "code",
      severity: f.severity === "fail" ? "high" : f.severity === "warn" ? "medium" : "low",
      title: f.title,
      detail: f.detail,
      values: [...new Set(f.citations.map((c) => c.value).filter(Boolean) as string[])],
      citations: f.citations.map((c) => ({ ...c, verified: true })),
      effectiveStatus: statusOf(rv.review),
    });
  }
  for (const it of analysis?.items ?? []) {
    if (it.kind === "fact") continue;
    const key = aiItemKey(it);
    const citations = it.citations.map(toCite);
    const basis = aiItemBasis(it);
    const rv = reviewable(key, basis, reviews);
    findings.push({
      ...rv,
      group: it.kind === "inconsistency" ? "discrepancy" : "missing_info",
      provenance: aiProv,
      severity: it.kind === "inconsistency" ? (it.uncertainty === "high" ? "medium" : "high") : "medium",
      title: it.field,
      detail: it.value,
      values: [],
      citations,
      effectiveStatus: statusOf(rv.review),
    });
  }

  // ---- Applicability questions (things a human must settle before relying on the matrix) ----
  const questions: ApplicabilityQuestion[] = [];
  const ws = state.workspace;
  if (ws.classification.value === "Not yet classified" || !ws.classification.verified) {
    questions.push({
      id: "q-class",
      question: "What is the device's confirmed risk class under MDR 2017?",
      why: ws.classification.value === "Not yet classified" ? "The workspace has no classification." : `The workspace says "${ws.classification.value}" but this is not marked verified.`,
    });
  }
  if (ws.pathway.value === "Not yet decided" || !ws.pathway.verified) {
    questions.push({
      id: "q-pathway",
      question: "Which application route and form apply (e.g. manufacturing vs import licence)?",
      why: ws.pathway.value === "Not yet decided" ? "No pathway selected." : `"${ws.pathway.value}" is not marked verified.`,
    });
  }
  if (set.verification === "synthetic_demo") {
    questions.push({
      id: "q-synthetic",
      question: "Which official requirements apply to this product?",
      why: "The selected checklist is synthetic demo data; no regulatory requirements were evaluated.",
    });
  }
  if (applicability && !applicability.applicable) {
    questions.push({ id: "q-scope", question: "Does the official requirement set apply to this workspace?", why: applicability.reason });
  }
  if (set.verification === "official_text") {
    questions.push({
      id: "q-amend",
      question: "Have amendments after 14 Oct 2022 or the online portal checklist changed these requirements?",
      why: "Only the CDSCO text as amended to 14 Oct 2022 was checked; later amendments and the portal checklist were not reviewed.",
    });
  }
  for (const r of requirements.filter((x) => x.effectiveStatus === "needs_review" && !x.dismissed)) {
    questions.push({
      id: `q-${r.requirement.id}`,
      question: `Is there evidence for "${r.requirement.title}" (${r.requirement.id})?`,
      why: r.codeNote ?? (r.rationale || "The evidence could not be assessed automatically."),
    });
  }

  // ---- Prioritised actions ----
  const actions: ReportAction[] = [];
  const reviewState = (x: Reviewable) =>
    x.dismissed ? "dismissed" : x.review.decision !== "undecided" ? x.review.decision : x.humanReviewed ? "reviewed" : "awaiting review";
  for (const u of uploads.filter((d) => d.status !== "extracted")) {
    actions.push({
      id: `a-doc-${u.id}`,
      priority: 1,
      title: `Make ${u.filename} readable`,
      action: u.status === "needs_ocr" ? "Provide a text-based PDF (this one has no extractable text)." : "Re-export or replace the file; it could not be read.",
      reason: u.error ?? "Document could not be analysed.",
      itemKey: `doc:${u.id}`,
      provenance: "code",
      citations: [],
      reviewState: "n/a",
    });
  }
  for (const r of requirements) {
    if (r.dismissed) continue;
    const s = r.effectiveStatus;
    if (s === "found" || s === "not_assessed") continue;
    const priority = s === "conflicting" ? 1 : s === "missing" || s === "partial" ? 2 : 3;
    actions.push({
      id: `a-${r.key}`,
      priority,
      title: `${r.requirement.id} ${r.requirement.title}: ${EVIDENCE_LABEL[s]}`,
      action: r.nextAction || (s === "missing" ? "Locate or prepare the expected evidence." : "Review the cited passages."),
      reason: r.rationale || r.codeNote || "",
      itemKey: r.key,
      provenance: r.evidenceProvenance ?? r.requirementProvenance,
      citations: r.citations,
      reviewState: reviewState(r),
    });
  }
  for (const f of findings) {
    if (f.dismissed || f.effectiveStatus === "resolved") continue;
    const priority = f.group === "missing_info" ? 3 : f.severity === "high" || f.effectiveStatus === "confirmed" ? 1 : f.severity === "medium" ? 2 : 3;
    actions.push({
      id: `a-${f.key}`,
      priority,
      title: f.group === "missing_info" ? `Possible gap: ${f.title}` : f.title,
      action:
        f.group === "missing_info"
          ? "Check whether this information exists elsewhere and add it if needed."
          : "Confirm the correct value with the document owner and align all documents.",
      reason: f.detail,
      itemKey: f.key,
      provenance: f.provenance,
      citations: f.citations,
      reviewState: reviewState(f),
    });
  }
  const unverifiedFields = (Object.keys(WORKSPACE_LABELS) as WorkspaceFieldKey[]).filter((k) => !ws[k].verified);
  if (unverifiedFields.length) {
    actions.push({
      id: "a-ws-fields",
      priority: 3,
      title: "Verify workspace details",
      action: `Confirm against source documents: ${unverifiedFields.map((k) => WORKSPACE_LABELS[k]).join(", ")}.`,
      reason: "Unverified fields affect applicability and consistency checks.",
      itemKey: "workspace",
      provenance: "code",
      citations: [],
      reviewState: "n/a",
    });
  }
  actions.sort((a, b) => a.priority - b.priority);

  // ---- Counts ----
  const evidence = Object.fromEntries([...EVIDENCE_STATUS, "not_assessed"].map((s) => [s, 0])) as GapReport["counts"]["evidence"];
  for (const r of requirements) if (!r.dismissed) evidence[r.effectiveStatus]++;
  const live = [...requirements.filter((r) => r.effectiveStatus !== "not_assessed"), ...findings];
  const awaitingReview = live.filter((x) => !x.dismissed && !x.humanReviewed);
  const discrepancies = findings.filter((f) => f.group === "discrepancy" && !f.dismissed);

  return {
    generatedFor: today ?? "",
    isDemo: state.isDemo,
    set,
    applicability,
    mapping,
    analysis,
    documents: {
      total: uploads.length,
      usable: uploads.filter((u) => u.status === "extracted").length,
      unusable: uploads.filter((u) => u.status !== "extracted"),
    },
    requirements,
    findings,
    questions,
    actions,
    awaitingReview,
    counts: {
      evidence,
      discrepanciesOpen: discrepancies.filter((f) => f.effectiveStatus === "open").length,
      discrepanciesConfirmed: discrepancies.filter((f) => f.effectiveStatus === "confirmed").length,
      discrepanciesResolved: discrepancies.filter((f) => f.effectiveStatus === "resolved").length,
      missingInfoOpen: findings.filter((f) => f.group === "missing_info" && !f.dismissed && f.effectiveStatus !== "resolved").length,
      dismissed: live.filter((x) => x.dismissed).length,
      awaitingReview: awaitingReview.length,
      reviewed: live.filter((x) => x.humanReviewed && !x.dismissed).length,
      changedSinceReview: live.filter((x) => x.changedSinceReview).length,
      unverifiedWorkspaceFields: unverifiedFields.length,
    },
  };
}
