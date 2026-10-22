import { EVIDENCE_LABEL } from "./mapping";
import { FINDING_STATUS_LABEL } from "./review";
import { VALIDATION_LABEL, type ValidationReport } from "./regulatory/types";
import { DISPLAY_LABEL, PROVENANCE_LABEL, type GapReport, type ReportCitation } from "./report";

/**
 * RFC 4180 CSV with spreadsheet-safety:
 * - every field is quoted; embedded quotes are doubled; commas and newlines stay inside quotes;
 * - cells that a spreadsheet would treat as a formula (starting with = + - @, tab or CR,
 *   even after leading spaces) get a leading apostrophe so they are shown as text.
 */
export function csvCell(v: string | number | boolean | null | undefined): string {
  let s = v === null || v === undefined ? "" : String(v);
  // Check before normalising line endings: a leading tab/CR is itself a trigger, and "\s*" must not swallow it.
  const risky = /^[\t\r]/.test(s) || /^[  ]*[=+\-@]/.test(s);
  s = s.replace(/\r\n?/g, "\n");
  if (risky) s = `'${s}`;
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
      DISPLAY_LABEL[x.display],
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
    ["priority", "requirement_id", "title", "recommended_action", "reason", "source", "files", "pages", "quotations", "review_state", "data_origin"],
    r.actions.map((a) => [
      a.priority === 1 ? "1 - high" : a.priority === 2 ? "2 - medium" : "3 - low",
      a.ref ?? "",
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

/** The CDSCO validation report, one row per requirement — the same data the Readiness Brief shows. */
export function validationCsv(v: ValidationReport): string {
  return toCsv(
    [
      "requirement_id", "requirement", "official_reference", "source_url", "source_pdf_page", "source_verified",
      "applicability", "applicability_rationale", "validation_status", "explanation", "what_was_searched",
      "evidence", "ai_proposed_status", "deterministic_checks", "next_action", "human_review_required",
      "pathway_decision", "library_version", "generated_at", "data_origin", "disclaimer",
    ],
    v.results.map((r) => [
      r.requirementId,
      r.title,
      r.reference,
      r.sourceUrl,
      r.sourcePage,
      r.sourceVerified ? "verified" : "UNVERIFIED",
      r.applicability.decision,
      r.applicability.rationale,
      VALIDATION_LABEL[r.status],
      r.explanation,
      r.searched,
      r.evidence
        .map((e) => `[${e.kind === "ai_quote" ? `AI quote, ${e.check}` : e.kind === "keyword" ? "keyword located by code" : "compared by code"}] ${e.filename} p.${e.page ?? "?"}: "${e.text}"`)
        .join(" | "),
      r.ai?.proposedStatus ?? "",
      r.deterministic.map((d) => `${d.check}: ${d.outcome}`).join(" | "),
      r.nextAction,
      r.humanReviewRequired ? "yes" : "no",
      v.decision.label,
      `${v.pathway.id} v${v.pathway.libraryVersion} (checked ${v.pathway.lastReviewed})`,
      v.generatedAt,
      v.synthetic ? "SYNTHETIC DEMO DATA" : "user workspace",
      "Prototype readiness assessment. Not an official CDSCO decision, legal opinion or compliance certification.",
    ]),
  );
}
