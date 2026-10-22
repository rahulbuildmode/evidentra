import type { AnalysisResult } from "./analysis";
import type { CheckRecord } from "./run";
import type { Finding, FindingCitation, Workspace } from "./types";

/**
 * Deterministic (plain-code) consistency checks. They only use AI-extracted facts whose
 * quotations were verified in the PDF text, and compare values exactly after normalising.
 * Semantic differences (meaning, paraphrase) are left to the AI findings and the reviewer.
 */

/** Uppercase and strip everything except letters and digits, so "AP-200A" equals "ap 200a". */
export function normalizeIdentifier(s: string): string {
  return s.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** Names and free text: ignore case, punctuation and spacing ("Pvt. Ltd." = "Pvt Ltd"). */
export function normalizeName(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function todayISO(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export interface VerifiedFact {
  id: string;
  category: string;
  label: string;
  value: string;
  filename: string;
  page: number;
  quote: string;
  normalizedDate: string | null;
}

/** Facts whose quotation was found in the extracted text (page set by code, not the model). */
export function verifiedFactsOf(result: AnalysisResult | null): VerifiedFact[] {
  if (!result) return [];
  const out: VerifiedFact[] = [];
  for (const it of result.items) {
    const c = it.citations[0];
    if (it.kind !== "fact" || !c || c.verifiedPage === null) continue;
    out.push({
      id: it.id,
      category: it.category,
      label: it.field,
      value: it.value,
      filename: c.filename,
      page: c.verifiedPage,
      quote: c.quote,
      normalizedDate: it.normalizedDate ?? null,
    });
  }
  return out;
}

const cite = (f: VerifiedFact): FindingCitation => ({
  filename: f.filename,
  page: f.page,
  quote: f.quote,
  value: f.value,
});

/** Same field across documents must match after normalising. */
function compareAcrossDocuments(
  facts: VerifiedFact[],
  category: string,
  label: string,
  normalize: (s: string) => string,
  mismatch: {
    severity: Finding["severity"];
    note: string;
    withinDocument?: boolean;
  },
): Finding[] {
  const group = facts.filter((f) => f.category === category);
  const fileCount = new Set(group.map((f) => f.filename)).size;
  // Identifiers must also agree between passages of the same document; free text only across documents.
  if (group.length < 2 || (fileCount < 2 && !mismatch.withinDocument))
    return [];
  const where =
    fileCount > 1 ? "across documents" : `within ${group[0].filename}`;
  const keys = new Set(group.map((f) => normalize(f.value)));
  if (keys.size > 1) {
    const values = [...new Set(group.map((f) => f.value))];
    return [
      {
        id: `cc-${category}-mismatch`,
        check: label,
        severity: mismatch.severity,
        title: `${label} differs ${where}`,
        detail: `${values.length} different values: ${values.map((v) => `"${v}"`).join(" vs ")}. ${mismatch.note}`,
        citations: group.map(cite),
      },
    ];
  }
  const raw = new Set(group.map((f) => f.value));
  if (raw.size > 1) {
    return [
      {
        id: `cc-${category}-format`,
        check: label,
        severity: "info",
        title: `${label} written differently but identical after normalising`,
        detail: `Values: ${[...raw].map((v) => `"${v}"`).join(" / ")}. Consider one consistent spelling.`,
        citations: group.map(cite),
      },
    ];
  }
  return [];
}

/** Technical specifications: group by parameter name, compare values exactly. */
function compareSpecifications(facts: VerifiedFact[]): Finding[] {
  const specs = facts.filter((f) => f.category === "technical_specification");
  const byParam = new Map<string, VerifiedFact[]>();
  for (const f of specs)
    byParam.set(normalizeName(f.label), [
      ...(byParam.get(normalizeName(f.label)) ?? []),
      f,
    ]);
  const out: Finding[] = [];
  for (const [key, group] of byParam) {
    if (new Set(group.map((f) => f.filename)).size < 2) continue;
    if (new Set(group.map((f) => normalizeName(f.value))).size > 1) {
      out.push({
        id: `cc-spec-${key}`,
        check: "Technical specification",
        severity: "fail",
        title: `"${group[0].label}" differs across documents`,
        detail: `Values: ${[...new Set(group.map((f) => f.value))].map((v) => `"${v}"`).join(" vs ")}. Confirm the correct value against test data.`,
        citations: group.map(cite),
      });
    }
  }
  return out;
}

/** A single document should not state two different revisions. */
function compareRevisions(facts: VerifiedFact[]): Finding[] {
  const revs = facts.filter((f) => f.category === "document_revision");
  const out: Finding[] = [];
  for (const file of new Set(revs.map((f) => f.filename))) {
    const group = revs.filter((f) => f.filename === file);
    if (new Set(group.map((f) => normalizeIdentifier(f.value))).size > 1) {
      out.push({
        id: `cc-revision-${normalizeName(file)}`,
        check: "Document revision",
        severity: "warn",
        title: `${file} states more than one revision`,
        detail: `Revisions found: ${group.map((f) => `"${f.value}"`).join(", ")}.`,
        citations: group.map(cite),
      });
    }
  }
  return out;
}

function daysBetween(fromISO: string, toISO: string): number {
  return Math.round(
    (Date.parse(`${toISO}T00:00:00Z`) - Date.parse(`${fromISO}T00:00:00Z`)) /
      86_400_000,
  );
}

/** "Valid until"/expiry dates (normalised and confirmed in the quote by the server) vs today. */
function checkValidityDates(facts: VerifiedFact[], today: string): Finding[] {
  const out: Finding[] = [];
  for (const f of facts) {
    if (
      f.category !== "document_date" ||
      !/valid|expir/i.test(f.label) ||
      !f.normalizedDate
    )
      continue;
    const days = daysBetween(today, f.normalizedDate);
    if (days < 0) {
      out.push({
        id: `cc-expired-${f.id}`,
        check: "Validity date",
        severity: "fail",
        title: `Validity date has passed (${f.filename})`,
        detail: `The document states "${f.value}" (${f.normalizedDate}), ${Math.abs(days)} days before ${today}.`,
        citations: [cite(f)],
      });
    } else if (days <= 90) {
      out.push({
        id: `cc-expiring-${f.id}`,
        check: "Validity date",
        severity: "warn",
        title: `Validity ends within 90 days (${f.filename})`,
        detail: `The document states "${f.value}" (${f.normalizedDate}), ${days} days after ${today}.`,
        citations: [cite(f)],
      });
    }
  }
  return out;
}

// Kept for reference; the workspace form was removed, so this check is no longer run.
export function workspaceVsDocuments(facts: VerifiedFact[], ws: Workspace): Finding[] {
  const entered = ws.modelNumber.value.trim();
  const models = facts.filter((f) => f.category === "model_number");
  if (!entered || models.length === 0) return [];
  const off = models.filter(
    (f) => normalizeIdentifier(f.value) !== normalizeIdentifier(entered),
  );
  if (off.length === 0) return [];
  return [
    {
      id: "cc-workspace-model",
      check: "Workspace vs documents",
      severity: "fail",
      title: "Workspace model number does not match some documents",
      detail: `The workspace says "${entered}", but ${off.length} passage(s) give a different model number.`,
      citations: off.map(cite),
    },
  ];
}

/** `today` is null until the browser clock is known; date checks are skipped in that case. */
export function crossCheck(
  result: AnalysisResult | null,
  ws: Workspace,
  today: string | null,
): Finding[] {
  const facts = verifiedFactsOf(result);
  return [
    ...compareAcrossDocuments(
      facts,
      "model_number",
      "Model number",
      normalizeIdentifier,
      {
        severity: "fail",
        withinDocument: true,
        note: "A reviewer should confirm which value is correct.",
      },
    ),
    ...compareAcrossDocuments(
      facts,
      "device_name",
      "Device name",
      normalizeName,
      {
        severity: "fail",
        withinDocument: true,
        note: "A reviewer should confirm which name is correct.",
      },
    ),
    ...compareAcrossDocuments(
      facts,
      "manufacturer_name",
      "Manufacturer name",
      normalizeName,
      {
        severity: "fail",
        withinDocument: true,
        note: "A reviewer should confirm the legal manufacturer name.",
      },
    ),
    ...compareAcrossDocuments(
      facts,
      "intended_use",
      "Intended use wording",
      normalizeName,
      {
        severity: "warn",
        note: "This is an exact-text comparison; see the AI findings for whether the meaning differs.",
      },
    ),
    ...compareSpecifications(facts),
    ...compareRevisions(facts),
    ...(today ? checkValidityDates(facts, today) : []),
  ];
}

/**
 * Every deterministic comparison that crossCheck actually executes, with its outcome taken from
 * crossCheck's own findings (so the trace can never disagree with what was flagged).
 */
export function traceChecks(result: AnalysisResult | null, ws: Workspace, today: string | null): CheckRecord[] {
  const facts = verifiedFactsOf(result);
  const ids = new Set(crossCheck(result, ws, today).map((f) => f.id));
  const out: CheckRecord[] = [];
  const cmp = (f: VerifiedFact) => ({ value: f.value, filename: f.filename, page: f.page });

  const identity: [string, string, boolean][] = [
    ["model_number", "Model number", true],
    ["device_name", "Device name", true],
    ["manufacturer_name", "Manufacturer name", true],
    ["intended_use", "Intended use wording", false],
  ];
  for (const [category, label, within] of identity) {
    const group = facts.filter((f) => f.category === category);
    const files = new Set(group.map((f) => f.filename)).size;
    if (group.length < 2 || (files < 2 && !within)) continue;
    const differs = ids.has(`cc-${category}-mismatch`);
    const format = ids.has(`cc-${category}-format`);
    out.push({
      id: `chk-${category}`,
      check: "Exact comparison",
      field: label,
      compared: group.map(cmp),
      outcome: differs ? "differs" : format ? "format_only" : "consistent",
      detail: differs ? "Values differ after normalising." : format ? "Same value, written differently." : "All values match.",
    });
  }

  const specs = facts.filter((f) => f.category === "technical_specification");
  const byParam = new Map<string, VerifiedFact[]>();
  for (const f of specs) byParam.set(normalizeName(f.label), [...(byParam.get(normalizeName(f.label)) ?? []), f]);
  for (const [key, group] of byParam) {
    if (new Set(group.map((f) => f.filename)).size < 2) continue;
    const differs = ids.has(`cc-spec-${key}`);
    out.push({
      id: `chk-spec-${key}`,
      check: "Specification comparison",
      field: group[0].label,
      compared: group.map(cmp),
      outcome: differs ? "differs" : "consistent",
      detail: differs ? "Values differ across documents." : "Values match across documents.",
    });
  }

  const revs = facts.filter((f) => f.category === "document_revision");
  for (const file of new Set(revs.map((f) => f.filename))) {
    const group = revs.filter((f) => f.filename === file);
    const differs = ids.has(`cc-revision-${normalizeName(file)}`);
    out.push({
      id: `chk-rev-${normalizeName(file)}`,
      check: "Revision consistency",
      field: `Revision in ${file}`,
      compared: group.map(cmp),
      outcome: differs ? "differs" : "consistent",
      detail: differs ? "More than one revision is stated." : "One revision stated.",
    });
  }

  if (today) {
    for (const f of facts) {
      if (f.category !== "document_date" || !/valid|expir/i.test(f.label) || !f.normalizedDate) continue;
      const expired = ids.has(`cc-expired-${f.id}`);
      const soon = ids.has(`cc-expiring-${f.id}`);
      out.push({
        id: `chk-date-${f.id}`,
        check: "Validity date",
        field: `${f.label} (${f.filename})`,
        compared: [cmp(f)],
        outcome: expired ? "failed" : soon ? "warning" : "passed",
        detail: expired ? `Date has passed (checked against ${today}).` : soon ? `Ends within 90 days of ${today}.` : `Still valid on ${today}.`,
      });
    }
  }
  return out;
}
