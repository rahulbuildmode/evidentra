import type { AnalysisItem, AnalysisResult, ModelOutput } from "../analysis";
import { traceChecks, todayISO } from "../checks";
import { BLANK_WORKSPACE } from "../demo-data";
import type { MappingOutput, MappingResult } from "../mapping";
import { MFG_LICENCE_BCD } from "../regulatory/library";
import type { ValidationReport } from "../regulatory/types";
import type { RequirementSet } from "../requirements";
import type { AiStageRecord, CheckRecord, DocumentOutcome, QuoteRecord } from "../run";
import type { UploadedDocument, UploadedDocumentMeta } from "../uploads";
import { getMapping, saveAnalysis, saveMapping, saveValidation } from "./analysis-store";
import { getDocument, listDocuments } from "./document-store";
import { AnalysisError, toItems, requestAnalysis } from "./gemini-analyze";
import type { AiTrace } from "./gemini-common";
import { mapRequirements } from "./gemini-map";
import type { RunRecorder } from "./run-recorder";
import { buildValidation } from "./validation";
import { checkCitation } from "./verify-quotes";

/**
 * The analysis pipeline with every step recorded as it really happens. Reuses the existing
 * functions (Gemini request, quote verification, deterministic checks, evidence rules, storage).
 * A failed step stops the run; work that already succeeded (e.g. the analysis when mapping fails) is kept.
 */

const SKIP_AFTER_FAILURE = "Not run: an earlier step failed.";

function outcomeOf(m: UploadedDocumentMeta): DocumentOutcome {
  return {
    id: m.id,
    filename: m.filename,
    status: m.status,
    pages: m.pageCount,
    extractMs: m.extractMs ?? null,
    uploadedAt: m.uploadedAt,
    included: m.status === "extracted",
    reason: m.status === "needs_ocr" ? "No extractable text — OCR may be required" : m.status === "failed" ? (m.error ?? "Extraction failed") : null,
  };
}

/** Steps 1–2: the documents in the workspace and their stored extracted text. */
export async function recordDocuments(rec: RunRecorder, workspaceId: string): Promise<UploadedDocument[] | null> {
  rec.start("documents", "Listing the workspace's validated uploads");
  const metas = await listDocuments(workspaceId);
  rec.run.documents = metas.map(outcomeOf);
  for (const d of rec.run.documents) {
    rec.event(d.included ? "document_processed" : "document_skipped", "documents", d.filename, {
      id: d.id,
      pages: d.pages,
      ...(d.reason ? { reason: d.reason } : {}),
    });
  }
  if (metas.length === 0) {
    rec.fail("documents", "no_documents", "No documents uploaded in this workspace.");
    return null;
  }
  const readable = rec.run.documents.filter((d) => d.included).length;
  rec.complete("documents", `${metas.length} uploaded · ${readable} readable · ${metas.length - readable} skipped`);

  rec.start("extraction", "Loading the page text extracted at upload");
  const docs: UploadedDocument[] = [];
  for (const d of rec.run.documents.filter((x) => x.included)) {
    const full = await getDocument(workspaceId, d.id);
    if (full) docs.push(full);
  }
  if (docs.length === 0) {
    rec.fail("extraction", "no_documents", "No document has extractable text. Scanned PDFs need OCR, which this prototype does not have.");
    return null;
  }
  rec.complete(
    "extraction",
    `Text was extracted page by page when each file was uploaded (times per file are listed); ${docs.reduce((n, d) => n + d.pages.length, 0)} pages loaded.`,
  );
  return docs;
}

export function quoteRecords(source: QuoteRecord["source"], entries: { context: string; c: { filename: string; page: number | null; quote: string } }[], docs: UploadedDocument[]): QuoteRecord[] {
  return entries.map(({ context, c }) => {
    const v = checkCitation(c, docs);
    return { source, context, quote: c.quote, proposedFilename: c.filename, proposedPage: c.page, check: v.check, verifiedPage: v.verifiedPage };
  });
}

/** Step 4: code checks every quotation in the proposal against the real text. */
export function recordVerification(rec: RunRecorder, out: ModelOutput, docs: UploadedDocument[], runId: string): AnalysisItem[] {
  rec.start("verification", "Searching the extracted text for every proposed quotation");
  const items = toItems(out, docs, runId);
  rec.run.quotes = quoteRecords(
    "analysis",
    [
      ...out.facts.map((f) => ({ context: f.label, c: f.citation })),
      ...out.inconsistencies.flatMap((x) => x.citations.map((c) => ({ context: x.topic, c }))),
    ],
    docs,
  );
  const n = (k: QuoteRecord["check"]) => rec.run.quotes.filter((q) => q.check === k).length;
  rec.complete(
    "verification",
    `${rec.run.quotes.length} quotations checked: ${n("verified")} verified, ${n("verified_other_page")} on another page, ${n("not_found")} not found, ${n("unknown_file")} unknown file`,
    { verified: n("verified"), otherPage: n("verified_other_page"), notFound: n("not_found"), unknownFile: n("unknown_file") },
  );
  return items;
}

/** Step 5: deterministic comparisons on the verified facts (server clock for date checks). */
export function recordChecks(rec: RunRecorder, analysis: AnalysisResult): CheckRecord[] {
  rec.start("checks", "Comparing verified values across documents");
  const today = todayISO();
  rec.run.checks = traceChecks(analysis, BLANK_WORKSPACE, today);
  const flagged = rec.run.checks.filter((c) => !["consistent", "passed"].includes(c.outcome)).length;
  rec.complete("checks", `${rec.run.checks.length} comparisons executed · ${flagged} flagged (dates checked against ${today}, server clock)`, {
    executed: rec.run.checks.length,
    flagged,
  });
  return rec.run.checks;
}

export function summarizeFindings(rec: RunRecorder, analysis: AnalysisResult | null, mapping: MappingResult | null) {
  const byStatus: Record<string, number> = {};
  const add = (k: string) => (byStatus[k] = (byStatus[k] ?? 0) + 1);
  const who = analysis?.source === "demo-seed" ? "Demo seed" : "AI suggestion";
  for (const it of analysis?.items ?? []) {
    if (it.kind === "missing") add(`${who} · absence (needs human check)`);
    else if (it.kind === "inconsistency")
      add(it.citations.every((c) => c.verifiedPage !== null) ? `${who} · all quotes verified` : `${who} · has an unverified quote`);
  }
  for (const c of rec.run.checks) if (!["consistent", "passed"].includes(c.outcome)) add("Code check flag");
  const requirements = mapping ? mapping.rows.reduce<Record<string, number>>((m, r) => ((m[r.status] = (m[r.status] ?? 0) + 1), m), {}) : null;
  rec.run.findings = { total: Object.values(byStatus).reduce((a, b) => a + b, 0), byStatus, requirements };
}

/** Step: the CDSCO validation engine on this run's results (applicability by code, quotes already verified). */
export async function recordValidation(
  rec: RunRecorder,
  workspaceId: string,
  results: { analysis: AnalysisResult | null; mapping: MappingResult | null },
): Promise<ValidationReport> {
  rec.start("validation", `Evaluating ${MFG_LICENCE_BCD.requirements.length} CDSCO requirements (library v${MFG_LICENCE_BCD.libraryVersion})`);
  const report = await buildValidation(workspaceId, results);
  const c = report.counts;
  rec.run.validation = { pathway: report.pathway.name, decision: report.decision.label, counts: c };
  rec.complete(
    "validation",
    `${report.decision.label}. ${c.evidence_found} evidence found · ${c.conflict_detected} conflict · ${c.potential_gap} potential gap · ${c.needs_human_review} need review · ${c.validated_against_source} validated against source · ${c.not_applicable} not applicable`,
    { counts: c, pathway: report.decision.status },
  );
  return report;
}

function aiTrace(rec: RunRecorder, stage: AiTrace["stage"]): AiTrace {
  const step = stage === "analysis" ? "ai_analysis" : "ai_mapping";
  return {
    stage,
    attempts: [],
    onRequest: (n, model) => rec.event("ai_request_started", step, `${n === 1 ? "Request sent" : `Request ${n} sent`} to ${model}`, { attempt: n, model }),
    onFallback: (f) => rec.event("ai_fallback", step, `${f.reason} — falling back to ${f.to}`, { from: f.from, to: f.to }),
    onAttempt: (a) =>
      rec.event("ai_attempt", step, a.note ?? (a.outcome === "ok" ? "Valid response received" : a.outcome), {
        attempt: a.attempt,
        model: a.model,
        outcome: a.outcome,
        httpStatus: a.httpStatus,
        durationMs: a.durationMs,
        promptTokens: a.promptTokens,
        outputTokens: a.outputTokens,
      }),
  };
}

function stageRecord(t: AiTrace, errorCode: string | null): AiStageRecord {
  return {
    stage: t.stage,
    model: t.model ?? "Not recorded",
    ...(t.fallbacks?.length ? { fallback: t.fallbacks } : {}),
    attempts: t.attempts,
    output: errorCode ? null : (t.output ?? null),
    errorCode,
  };
}

const errorOf = (e: unknown) =>
  e instanceof AnalysisError ? e : new AnalysisError("unavailable", 500, "The step failed unexpectedly. Earlier results are unchanged.");

/** The live run behind "Analyse dossier". */
export async function runLivePipeline(rec: RunRecorder, workspaceId: string, set: RequirementSet | null): Promise<void> {
  const docs = await recordDocuments(rec, workspaceId);
  if (!docs) return rec.skipRemaining(SKIP_AFTER_FAILURE);

  // AI request 1
  rec.start("ai_analysis", `Sending ${docs.length} document${docs.length === 1 ? "" : "s"} to Gemini`);
  const t1 = aiTrace(rec, "analysis");
  let analysis: AnalysisResult;
  try {
    const { data, model, usage, sent } = await requestAnalysis(docs, t1);
    for (const s of sent) {
      const d = rec.run.documents.find((x) => x.id === s.id);
      if (d) Object.assign(d, { charsSent: s.charsSent, truncated: s.truncated });
    }
    rec.run.ai.push(stageRecord(t1, null));
    rec.complete("ai_analysis", `${t1.attempts.length} network request${t1.attempts.length === 1 ? "" : "s"} · ${data.facts.length} facts, ${data.inconsistencies.length} inconsistencies, ${data.missing_information.length} possible gaps proposed`);
    const items = recordVerification(rec, data, docs, rec.runId);
    analysis = {
      runId: rec.runId,
      workspaceId,
      source: "gemini",
      model,
      createdAt: new Date().toISOString(),
      documents: sent,
      skipped: rec.run.documents.filter((d) => !d.included).map((d) => ({ filename: d.filename, reason: d.reason ?? "skipped" })),
      items,
      usage,
    };
  } catch (e) {
    const err = errorOf(e);
    rec.run.ai.push(stageRecord(t1, err.code));
    rec.fail("ai_analysis", err.code, err.message);
    return rec.skipRemaining(SKIP_AFTER_FAILURE);
  }
  recordChecks(rec, analysis);

  // AI request 2
  let mapping: MappingResult | null = null;
  if (!set) rec.skip("ai_mapping", "No requirement set selected.");
  else {
    rec.start("ai_mapping", `Matching ${set.requirements.length} requirements to the documents`);
    const t2 = aiTrace(rec, "mapping");
    try {
      mapping = await mapRequirements(workspaceId, set, docs, rec.runId, t2);
      rec.run.ai.push(stageRecord(t2, null));
      const proposal = t2.output as MappingOutput | undefined;
      const extra = quoteRecords(
        "mapping",
        (proposal?.rows ?? []).flatMap((r) => r.citations.map((c) => ({ context: set.requirements.find((q) => q.id === r.requirement_id)?.title ?? r.requirement_id, c }))),
        docs,
      );
      rec.run.quotes.push(...extra);
      const capped = mapping.rows.filter((r) => r.proposedStatus && r.proposedStatus !== r.status).length;
      rec.complete(
        "ai_mapping",
        `${t2.attempts.length} network request${t2.attempts.length === 1 ? "" : "s"} · ${mapping.rows.length} requirements · ${extra.filter((q) => q.verifiedPage !== null).length}/${extra.length} quotations verified · ${capped} status${capped === 1 ? "" : "es"} lowered by code rules`,
      );
    } catch (e) {
      const err = errorOf(e);
      rec.run.ai.push(stageRecord(t2, err.code));
      rec.fail("ai_mapping", err.code, err.message);
    }
  }

  const report = await recordValidation(rec, workspaceId, { analysis, mapping: mapping ?? (await getMapping(workspaceId)) });

  rec.start("save", "Saving results");
  await saveAnalysis(analysis);
  if (mapping) await saveMapping(mapping);
  await saveValidation(report);
  summarizeFindings(rec, analysis, mapping);
  rec.complete(
    "save",
    mapping
      ? "Analysis, requirement mapping and validation report saved; the readiness brief is built from them."
      : set
        ? "Analysis and validation report saved. Requirement mapping was not saved because AI request 2 failed; earlier mapping (if any) is unchanged."
        : "Analysis and validation report saved.",
  );
}
