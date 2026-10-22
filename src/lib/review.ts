import type { AnalysisItem } from "./analysis";
import type { EvidenceStatus } from "./mapping";

/**
 * Human review of a single report item. Keys are stable across re-runs (they describe *what*
 * the item is, not which run produced it), so reviews survive when the report is regenerated.
 * `basis` is a fingerprint of the item when it was reviewed; if the item later changes, the UI
 * flags "changed since review" instead of silently applying an old decision.
 */

export type ReviewDecision = "undecided" | "accepted" | "rejected";

/** Human-set status for a discrepancy. */
export const FINDING_STATUS = ["open", "confirmed", "resolved"] as const;
export type FindingStatus = (typeof FINDING_STATUS)[number];
export const FINDING_STATUS_LABEL: Record<FindingStatus, string> = {
  open: "Open",
  confirmed: "Confirmed — needs fixing",
  resolved: "Resolved",
};

export interface Review {
  reviewed: boolean;
  decision: ReviewDecision;
  /** Human status override: an EvidenceStatus for requirements, a FindingStatus for findings. */
  status: EvidenceStatus | FindingStatus | null;
  note: string;
  /** Set when a reviewer dismissed the item as a false positive. */
  dismissedReason: string | null;
  basis: string;
  updatedAt: string;
}

export const EMPTY_REVIEW: Review = {
  reviewed: false,
  decision: "undecided",
  status: null,
  note: "",
  dismissedReason: null,
  basis: "",
  updatedAt: "",
};

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);

export const requirementKey = (setId: string, reqId: string) => `req:${setId}:${reqId}`;
export const codeFindingKey = (findingId: string) => `cc:${findingId}`;

/** Stable key for an AI item: what it is about and which files it cites — not the run id. */
export function aiItemKey(it: AnalysisItem): string {
  const files = [...new Set(it.citations.map((c) => c.filename))].sort().join("+");
  if (it.kind === "fact") return `ai:fact:${it.category}:${norm(it.value)}:${files}`;
  return `ai:${it.kind}:${norm(it.field)}:${files}`;
}

/** Fingerprint of what the reviewer saw. */
export function fingerprint(parts: (string | number | null | undefined)[]): string {
  return parts.map((p) => String(p ?? "")).join("|").slice(0, 2000);
}

/** True when the review has any human input. */
export function hasHumanInput(r: Review | undefined): boolean {
  return Boolean(r && (r.reviewed || r.decision !== "undecided" || r.status || r.note.trim() || r.dismissedReason));
}

export function changedSinceReview(r: Review | undefined, basis: string): boolean {
  return Boolean(r && hasHumanInput(r) && r.basis && r.basis !== basis);
}
