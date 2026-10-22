import type { AnalysisResult, CheckedCitation } from "../analysis";
import { traceChecks } from "../checks";
import { BLANK_WORKSPACE } from "../demo-data";
import type { MappingResult } from "../mapping";
import type { CheckRecord } from "../run";
import type { PageText } from "../uploads";
import {
  VALIDATION_STATUS,
  type ApplicabilityDecision,
  type DeviceProfile,
  type EvidenceItem,
  type Pathway,
  type PathwayDecision,
  type RegRequirement,
  type RequirementResult,
  type ValidationReport,
  type ValidationStatus,
} from "./types";

/**
 * The CDSCO validation engine. Pure and deterministic: given the device profile, the pathway library,
 * the extracted text and the saved (already quote-verified) analysis and mapping, it decides
 * applicability by code, gathers evidence and returns one structured result per requirement.
 * The language model never decides applicability or the final status; its proposals are inputs.
 */

export interface ValidationInput {
  workspaceId: string;
  pathway: Pathway;
  profile: DeviceProfile;
  docs: { filename: string; pages: PageText[]; synthetic: boolean }[];
  skipped: { filename: string; reason: string }[];
  analysis: AnalysisResult | null;
  /** Ignored unless it was produced for this pathway's requirement ids. */
  mapping: MappingResult | null;
  today: string;
  now?: string;
}

const CLASS_LABEL = { A: "Class A", B: "Class B", C: "Class C", D: "Class D", unknown: "unknown" } as const;

/** Is this dossier inside the one supported pathway? Unknown details leave it unresolved, never assumed. */
export function decidePathway(pathway: Pathway, p: DeviceProfile): PathwayDecision {
  const reasons: string[] = [];
  const unknownFields: string[] = [];
  const out = (why: string) => reasons.push(why);
  if (p.activity === "unknown") unknownFields.push("Manufacture or import");
  else if (p.activity === "import") out("Import licences are not covered by this prototype's library.");
  if (p.riskClass === "unknown") unknownFields.push("Risk class");
  else if (p.riskClass === "A") out("Class A devices are not covered by this library (it covers clause (ii): Class B, C, D).");
  if (p.ivd === "unknown") unknownFields.push("In vitro diagnostic device?");
  else if (p.ivd === "yes") out("In vitro diagnostic devices are not covered by this library.");
  if (p.licenceType === "unknown") unknownFields.push("Licence or loan licence");
  else if (p.licenceType === "loan_licence") out("Loan licences are not covered by this library.");

  const basis = pathway.basis.find((b) => b.classes.includes(p.riskClass));
  if (reasons.length > 0) {
    return { status: "out_of_scope", label: "Not supported by this prototype", form: null, authority: null, reasons, unknownFields };
  }
  if (unknownFields.length > 0) {
    return {
      status: "unresolved",
      label: "Pathway unresolved — device details needed",
      form: basis?.form ?? null,
      authority: basis?.authority ?? null,
      reasons: [`Needed before requirements can be applied: ${unknownFields.join(", ")}.`],
      unknownFields,
    };
  }
  if (!p.riskClassConfirmed) {
    reasons.push(`${CLASS_LABEL[p.riskClass]} was entered but not confirmed against the official classification; results depend on it.`);
  }
  return {
    status: "in_scope",
    label: `${pathway.name} — ${CLASS_LABEL[p.riskClass]}`,
    form: basis?.form ?? null,
    authority: basis?.authority ?? null,
    reasons,
    unknownFields,
  };
}

/** Code decides applicability from the profile and the documented condition. */
export function decideApplicability(
  r: RegRequirement,
  p: DeviceProfile,
  decision: PathwayDecision,
): { decision: ApplicabilityDecision; rationale: string; conditional: boolean } {
  if (decision.status === "out_of_scope") {
    return { decision: "unresolved", rationale: `Not evaluated: ${decision.reasons.join(" ")}`, conditional: false };
  }
  if (decision.status === "unresolved") {
    return { decision: "unresolved", rationale: decision.reasons.join(" "), conditional: false };
  }
  const conditional = !p.riskClassConfirmed;
  const cond = conditional ? ` Based on the entered ${CLASS_LABEL[p.riskClass]}, which is not yet confirmed.` : "";
  switch (r.applicability.kind) {
    case "always_in_pathway":
      return { decision: "applicable", rationale: `Listed for every application in this pathway (${r.reference}).${cond}`, conditional };
    case "non_ivd_only":
      // Pathway scope already requires ivd === "no".
      return { decision: "applicable", rationale: `Applies to devices other than in vitro diagnostics; the profile says the device is not an IVD.${cond}`, conditional };
    case "ivd_only":
      return { decision: "not_applicable", rationale: "Applies only to in vitro diagnostic devices; the profile records that this device is not an IVD.", conditional: false };
    case "if_test_licence_obtained":
      if (p.testLicence === "yes") return { decision: "applicable", rationale: `The profile records that a test licence was obtained; the clause applies "if any".${cond}`, conditional };
      if (p.testLicence === "no")
        return { decision: "not_applicable", rationale: 'The profile records that no test licence was obtained; the clause applies only "if any".', conditional: false };
      return { decision: "unresolved", rationale: 'The clause applies only "if any" test licence was obtained. The profile does not say whether one was.', conditional: false };
    case "interpretation_required":
      return { decision: "unresolved", rationale: r.applicability.question, conditional: false };
    case "md7_checklist_class_cd":
      if (p.riskClass === "C" || p.riskClass === "D")
        return { decision: "applicable", rationale: `Listed in CDSCO's official Form MD-7 checklist, which covers Class C and D.${cond}`, conditional };
      return {
        decision: "unresolved",
        rationale: "Listed only in CDSCO's Form MD-7 (Class C/D) checklist. No official checklist for Form MD-3 (Class B) was verified, so whether it is expected for Class B is unresolved.",
        conditional: false,
      };
  }
}

/** Code-located passages: the line on which a search term literally appears (no model involved). */
export function keywordHits(terms: string[], docs: ValidationInput["docs"], limit = 4): EvidenceItem[] {
  const hits: EvidenceItem[] = [];
  for (const d of docs) {
    for (const pg of d.pages) {
      const lines = pg.text.split("\n");
      for (const line of lines) {
        const low = line.toLowerCase();
        if (terms.some((t) => low.includes(t.toLowerCase()))) {
          hits.push({ kind: "keyword", filename: d.filename, page: pg.page, text: line.trim().slice(0, 240), synthetic: d.synthetic });
          break; // one line per page is enough to point at it
        }
      }
      if (hits.length >= limit) return hits;
    }
  }
  return hits;
}

const IDENTITY_FIELD = { model_number: "Model number", device_name: "Device name", manufacturer_name: "Manufacturer name" } as const;

function quoteItem(c: CheckedCitation, synthetic: (f: string) => boolean): EvidenceItem {
  return { kind: "ai_quote", filename: c.filename, page: c.verifiedPage, proposedPage: c.claimedPage, text: c.quote, check: c.check, synthetic: synthetic(c.filename) };
}

function evaluate(r: RegRequirement, input: ValidationInput, decision: PathwayDecision, checks: CheckRecord[], mapping: MappingResult | null): RequirementResult {
  const { profile, docs } = input;
  const synthetic = (f: string) => docs.find((d) => d.filename === f)?.synthetic ?? false;
  const applicability = decideApplicability(r, profile, decision);
  const pages = docs.reduce((n, d) => n + d.pages.length, 0);
  const terms = "searchTerms" in r.criterion ? r.criterion.searchTerms : [];
  const searched =
    docs.length === 0
      ? "No readable documents were available to search."
      : `Searched ${docs.length} readable document${docs.length === 1 ? "" : "s"} (${pages} page${pages === 1 ? "" : "s"})${terms.length ? ` for: ${terms.map((t) => `“${t}”`).join(", ")}` : ""}.${
          input.skipped.length ? ` Not searched (no usable text): ${input.skipped.map((s) => s.filename).join(", ")}.` : ""
        }`;

  const row = mapping?.rows.find((x) => x.requirementId === r.id) ?? null;
  const evidence: EvidenceItem[] = [];
  if (row) evidence.push(...row.citations.map((c) => quoteItem(c, synthetic)));
  const keywords = terms.length ? keywordHits(terms, docs) : [];
  evidence.push(...keywords);
  const deterministic: RequirementResult["deterministic"] = [];

  const base = {
    requirementId: r.id,
    title: r.title,
    reference: r.reference,
    sourceUrl: r.sourceUrl,
    sourcePage: r.sourcePage,
    excerpt: r.excerpt,
    sourceTitle: r.sourceTitle,
    sourceVerified: r.verification.status === "verified",
    checklist:
      r.checklist && input.pathway.checklistSource.appliesTo.includes(profile.riskClass) ? { ...r.checklist, url: input.pathway.checklistSource.url } : null,
    applicability,
    searched,
    ai: row ? { proposedStatus: row.proposedStatus, rationale: row.rationale, source: mapping!.source } : null,
  };
  const done = (status: ValidationStatus, explanation: string, nextAction: string, humanReviewRequired = true): RequirementResult => ({
    ...base,
    evidence,
    deterministic,
    status,
    explanation,
    nextAction,
    humanReviewRequired: humanReviewRequired || applicability.conditional,
  });

  if (!base.sourceVerified) {
    return done(
      "needs_human_review",
      "UNVERIFIED — DO NOT USE FOR A DEFINITIVE REGULATORY CONCLUSION. The official source of this requirement could not be verified.",
      "Verify the requirement against the official CDSCO source before relying on it.",
    );
  }
  if (applicability.decision === "not_applicable") {
    return done("not_applicable", applicability.rationale, "None, unless the device profile changes.", false);
  }

  // Deterministic checks first: they rest only on quote-verified values.
  const conflict: CheckRecord[] = [];
  if (r.criterion.kind === "evidence_and_identity") {
    for (const field of r.criterion.identityFields) {
      const c = checks.find((x) => x.check === "Exact comparison" && x.field === IDENTITY_FIELD[field]);
      if (!c) {
        deterministic.push({ check: `${IDENTITY_FIELD[field]} consistent across documents`, outcome: "not_evaluable", detail: "Fewer than two quote-verified values were available to compare." });
        continue;
      }
      const failed = c.outcome === "differs";
      deterministic.push({
        check: `${IDENTITY_FIELD[field]} consistent across documents`,
        outcome: failed ? "failed" : "passed",
        detail: `${c.detail} Values: ${c.compared.map((v) => `${v.value} (${v.filename} p.${v.page})`).join("; ")}`,
      });
      if (failed) {
        conflict.push(c);
        evidence.push(...c.compared.map((v) => ({ kind: "deterministic" as const, filename: v.filename, page: v.page, text: v.value, value: v.value, synthetic: synthetic(v.filename) })));
      }
    }
  }
  if (r.criterion.kind === "certificate_validity") {
    const dates = checks.filter((x) => x.check === "Validity date");
    for (const c of dates) {
      deterministic.push({ check: `Validity date — ${c.field}`, outcome: c.outcome === "failed" ? "failed" : "passed", detail: c.detail });
      evidence.push(...c.compared.map((v) => ({ kind: "deterministic" as const, filename: v.filename, page: v.page, text: v.value, value: v.value, synthetic: synthetic(v.filename) })));
    }
    if (dates.length === 0) deterministic.push({ check: "Certificate validity dates", outcome: "not_evaluable", detail: "No quote-verified validity date was available from the analysis." });
  }

  if (applicability.decision === "unresolved") {
    return done("needs_human_review", `Applicability unresolved: ${applicability.rationale}`, r.applicability.kind === "interpretation_required" ? r.nextActionIfMissing : "Complete the device profile so applicability can be decided.");
  }
  if (r.criterion.kind === "human_only") {
    return done("needs_human_review", r.criterionText, r.nextActionIfMissing);
  }
  if (conflict.length > 0) {
    return done(
      "conflict_detected",
      `Exact comparison of quote-verified values found different ${conflict.map((c) => c.field.toLowerCase()).join(" and ")} values across the documents.`,
      "Confirm the correct value with the document owner and align every document before submission.",
    );
  }
  if (r.criterion.kind === "certificate_validity") {
    const failed = deterministic.filter((d) => d.outcome === "failed");
    const passed = deterministic.filter((d) => d.outcome === "passed");
    if (failed.length) return done("potential_gap", `A quote-verified validity date has passed (checked against ${input.today}).`, r.nextActionIfMissing);
    if (passed.length)
      return done(
        "validated_against_source",
        `Every quote-verified validity date found (${passed.length}) is on or after ${input.today}. This check covers only dates the analysis extracted; certificates without an extracted date are not covered.`,
        "Confirm that every certificate in the dossier was captured by the analysis.",
        true,
      );
    return done(
      "needs_human_review",
      input.analysis
        ? "The analysis identified no quote-verified certificate validity date, so this check could not be evaluated."
        : "Not evaluable yet: validity dates come from the analysis, which has not run for these documents.",
      input.analysis ? "Check each certificate's validity date manually." : "Run Analyse dossier, or check each certificate's validity date manually.",
    );
  }

  // AI evidence matching (proposal) with code-verified quotations.
  const verifiedQuotes = row ? row.citations.filter((c) => c.verifiedPage !== null).length : 0;
  if (row) {
    const unverified = row.citations.length - verifiedQuotes;
    const note = unverified ? ` ${unverified} proposed quotation${unverified === 1 ? " was" : "s were"} not found in the extracted text and ${unverified === 1 ? "is" : "are"} not used as evidence.` : "";
    const who = mapping!.source === "demo-seed" ? "The demo seed" : "The AI";
    // Defensive: a proposal is never stronger than its verified quotations (finalizeRows already caps this).
    const status = (row.status === "found" || row.status === "partial") && verifiedQuotes === 0 ? "needs_review" : row.status === "conflicting" && verifiedQuotes < 2 ? "needs_review" : row.status;
    switch (status) {
      case "found":
        return done("evidence_found", `${who} proposed this as evidence and code verified ${verifiedQuotes} quotation${verifiedQuotes === 1 ? "" : "s"} in the text.${note} Sufficiency is not assessed.`, "Review the passage and confirm it meets the requirement.");
      case "conflicting":
        return done("conflict_detected", `${who} found passages that contradict each other; code verified ${verifiedQuotes} of them.${note}`, row.nextAction || "Resolve the contradiction between the cited documents.");
      case "missing":
        if (keywords.length)
          return done("needs_human_review", `${who} found no evidence, but code located the search terms on ${keywords.length} page${keywords.length === 1 ? "" : "s"}. A person should check them.${note}`, "Check the located passages.");
        return done("potential_gap", `Expected evidence was not located in the documents reviewed (AI evidence matching and keyword search). This is not proof that it is missing.${note}`, r.nextActionIfMissing);
      default:
        return done("needs_human_review", `${status === "partial" ? "Only partial evidence was identified." : verifiedQuotes === 0 && row.citations.length ? "None of the proposed quotations was found in the text." : "The evidence is unclear."} ${row.rationale}${note}`, row.nextAction || "Review the cited passages.");
    }
  }

  // No AI matching for this requirement: code keyword search only.
  if (keywords.length) {
    return done(
      "needs_human_review",
      `Code located the search terms on ${keywords.length} page${keywords.length === 1 ? "" : "s"}. AI evidence matching has not assessed this requirement, so relevance is unknown.`,
      "Run the analysis, or review the located passages.",
    );
  }
  return done(
    "potential_gap",
    "Expected evidence was not located by keyword search in the documents reviewed, and AI evidence matching has not run for this requirement. This is not proof that it is missing.",
    r.nextActionIfMissing,
  );
}

export function validateDossier(input: ValidationInput): ValidationReport {
  const { pathway, profile, analysis } = input;
  const ids = new Set(pathway.requirements.map((r) => r.id));
  const mapping = input.mapping && input.mapping.rows.some((r) => ids.has(r.requirementId)) ? input.mapping : null;
  const decision = decidePathway(pathway, profile);
  const checks = traceChecks(analysis, BLANK_WORKSPACE, input.today);
  const results = pathway.requirements.map((r) => evaluate(r, input, decision, checks, mapping));

  const counts = Object.fromEntries(VALIDATION_STATUS.map((s) => [s, 0])) as Record<ValidationStatus, number>;
  for (const r of results) counts[r.status]++;

  // Ordered by status category only (conflicts, then gaps, then reviews). No invented severity.
  const order: ValidationStatus[] = ["conflict_detected", "potential_gap", "needs_human_review"];
  const actions = order.flatMap((s) =>
    results.filter((r) => r.status === s).map((r) => ({ requirementId: r.requirementId, title: r.title, status: s, action: r.nextAction })),
  );

  const unresolved: ValidationReport["unresolved"] = [];
  for (const f of decision.unknownFields) unresolved.push({ item: `Device profile: ${f}`, why: "Needed to decide which requirements apply." });
  if (profile.riskClass !== "unknown" && !profile.riskClassConfirmed)
    unresolved.push({ item: `Risk class (${CLASS_LABEL[profile.riskClass]}) not confirmed`, why: "Applicability depends on it. Confirm against the official CDSCO classification." });
  for (const r of results.filter((x) => x.applicability.decision === "unresolved" && decision.status === "in_scope"))
    unresolved.push({ item: `${r.title} (${r.reference})`, why: r.applicability.rationale });
  for (const r of results.filter((x) => !x.sourceVerified)) unresolved.push({ item: `${r.title}: source unverified`, why: "Do not use for a definitive regulatory conclusion." });
  for (const s of input.skipped) unresolved.push({ item: `${s.filename} was not searched`, why: s.reason });
  unresolved.push({ item: "Amendments after 14 Oct 2022 and the current online-portal checklist", why: "Not reviewed against this library." });

  const mappingStale = Boolean(mapping && analysis && mapping.createdAt < analysis.createdAt);
  const synthetic = input.docs.some((d) => d.synthetic) || profile.origin === "demo";
  return {
    generatedAt: input.now ?? new Date().toISOString(),
    today: input.today,
    workspaceId: input.workspaceId,
    synthetic,
    pathway: { id: pathway.id, name: pathway.name, libraryVersion: pathway.libraryVersion, lastReviewed: pathway.lastReviewed, source: pathway.source, scope: pathway.scope, notCovered: pathway.notCovered },
    profile,
    decision,
    inputs: {
      analysis: analysis ? { runId: analysis.runId, source: analysis.source ?? "gemini", createdAt: analysis.createdAt, model: analysis.model } : null,
      mapping: mapping ? { runId: mapping.runId, source: mapping.source, createdAt: mapping.createdAt, model: mapping.model, stale: mappingStale } : null,
      documentsReviewed: input.docs.map((d) => ({ filename: d.filename, pages: d.pages.length, synthetic: d.synthetic })),
      documentsSkipped: input.skipped,
    },
    results,
    counts,
    actions,
    unresolved,
    limitations: [
      "Prototype readiness assessment — not an official CDSCO decision, legal opinion or compliance certification.",
      `Covers one pathway with ${pathway.requirements.length} selected items; it is not a complete list of requirements.`,
      "“Potential gap” means not located in the documents reviewed — not that the document does not exist.",
      "“Evidence found” means relevant text was located and verified — not that the requirement is satisfied.",
      "Scanned PDFs without a text layer cannot be searched (no OCR).",
      ...(synthetic ? ["Uses SYNTHETIC DEMO DATA: fictional documents and a fictional device profile."] : []),
    ],
  };
}
