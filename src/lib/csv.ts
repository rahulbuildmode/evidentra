import { EVIDENCE_LABEL } from "./mapping";
import { FINDING_STATUS_LABEL } from "./review";
import { PROVENANCE_LABEL, type GapReport, type ReportCitation } from "./report";

/**
 * RFC 4180 CSV with spreadsheet-safety:
 * - every field is quoted; embedded quotes are doubled; commas and newlines stay inside quotes;
 * - cells that a spreadsheet would treat as a formula (starting with = + - @, tab or CR,
 *   even after leading spaces) get a leading apostrophe so they are shown as text.
 */
export function csvCell(v: string | number | boolean | null | undefined): string {
  let s = v === null || v === undefined ? "" : String(v);
  s = s.replace(/\r\n?/g, "\n");
  if (/^\s*[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

export function toCsv(header: string[], rows: (string | number | boolean | null | undefined)[][]): string {
  // BOM so Excel opens UTF-8 (₹, ±, accented names) correctly; CRLF row endings per RFC 4180.
  return "﻿" + [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

const files = (c: ReportCitation[]) => c.map((x) => x.filename).join(" | ");
const pages = (c: ReportCitation[]) => c.map((x) => (x.page ?? "?") + (x.verified ? "" : " (unverified)")).join(" | ");
const quotes = (c: ReportCitation[]) => c.map((x) => x.quote).join(" | ");
const origin = (demo: boolean) => (demo ? "FICTIONAL DEMO" : "user workspace");

export function evidenceMatrixCsv(r: GapReport): string {
  return toCsv(
    [
      "requirement_id", "requirement", "requirement_type", "source_location", "applicability_verified",
      "expected_evidence", "evidence_source", "proposed_status", "current_status", "status_set_by_human",
      "rationale", "code_note", "files", "pages", "quotations", "next_action",
      "human_reviewed", "human_decision", "dismissed_reason", "reviewer_note", "changed_since_review", "data_origin",
    ],
    r.requirements.map((x) => [
      x.requirement.id,
      x.requirement.title,
      PROVENANCE_LABEL[x.requirementProvenance],
      x.requirement.sourceLocation,
      r.applicability ? (r.applicability.applicable ? "yes" : "no") : "n/a (synthetic)",
      x.requirement.expectedEvidence,
      x.evidenceProvenance ? PROVENANCE_LABEL[x.evidenceProvenance] : "not assessed",
      x.proposedStatus ? EVIDENCE_LABEL[x.proposedStatus] : "",
      x.effectiveStatus === "not_assessed" ? "Not assessed" : EVIDENCE_LABEL[x.effectiveStatus],
      x.overridden ? "yes" : "no",
      x.rationale,
      x.codeNote,
      files(x.citations),
      pages(x.citations),
      quotes(x.citations),
      x.nextAction,
      x.humanReviewed ? "yes" : "no",
      x.review.decision,
      x.review.dismissedReason,
      x.review.note,
      x.changedSinceReview ? "yes" : "no",
      origin(r.isDemo),
    ]),
  );
}

export function consistencyFindingsCsv(r: GapReport): string {
  return toCsv(
    [
      "finding_key", "type", "source", "severity", "title", "detail", "conflicting_values",
      "files", "pages", "quotations", "status", "human_reviewed", "human_decision",
      "dismissed_reason", "reviewer_note", "changed_since_review", "data_origin",
    ],
    r.findings.map((f) => [
      f.key,
      f.group === "discrepancy" ? "cross-document discrepancy" : "possible missing information",
      PROVENANCE_LABEL[f.provenance],
      f.severity,
      f.title,
      f.detail,
      f.values.join(" | "),
      files(f.citations),
      pages(f.citations),
      quotes(f.citations),
      FINDING_STATUS_LABEL[f.effectiveStatus],
      f.humanReviewed ? "yes" : "no",
      f.review.decision,
      f.review.dismissedReason,
      f.review.note,
      f.changedSinceReview ? "yes" : "no",
      origin(r.isDemo),
    ]),
  );
}

export function actionListCsv(r: GapReport): string {
  return toCsv(
    ["priority", "title", "recommended_action", "reason", "source", "files", "pages", "quotations", "review_state", "data_origin"],
    r.actions.map((a) => [
      a.priority === 1 ? "1 - high" : a.priority === 2 ? "2 - medium" : "3 - low",
      a.title,
      a.action,
      a.reason,
      PROVENANCE_LABEL[a.provenance],
      files(a.citations),
      pages(a.citations),
      quotes(a.citations),
      a.reviewState,
      origin(r.isDemo),
    ]),
  );
}
