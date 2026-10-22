import { randomUUID } from "node:crypto";
import {
  ModelOutputSchema,
  type AnalysisItem,
  type AnalysisResult,
  type CheckedCitation,
  type ModelOutput,
  type Uncertainty,
} from "../analysis";
import type { UploadedDocument } from "../uploads";
import { AnalysisError, buildDocumentsPrompt, generateStructured, UNTRUSTED_TEXT_RULES, type AiTrace } from "./gemini-common";
import { checkCitation, dateAppearsInQuote } from "./verify-quotes";

export { AnalysisError } from "./gemini-common";

const SYSTEM_INSTRUCTION = `You help regulatory affairs and quality staff at medical-device manufacturers review product documentation before a human regulatory review.

${UNTRUSTED_TEXT_RULES}

Return JSON matching the schema:
- facts: device name, model number, manufacturer name (legal name only) and manufacturer address as separate facts, intended use, technical specifications (label = the parameter name, e.g. "SpO2 accuracy"; value = the stated value), standards the documents themselves reference, and each document's date(s) and revision/version identifiers. One entry per distinct fact per document. For document_date facts also give normalized_date as YYYY-MM-DD; otherwise normalized_date is null. Label dates by meaning (e.g. "Document date", "Valid until", "Issue date").
- inconsistencies: where passages in different documents conflict in meaning: device name, model number, manufacturer, intended use or patient population, technical specifications, or document dates/revisions that reference each other. Explain the difference neutrally; do not call it a legal violation. Cite every conflicting passage.
- missing_information: information a reviewer would expect for describing the device (from the fact categories above) that is not found in these documents. Phrase it as "not found in the uploaded documents" — never claim a document does not exist. Do not name specific standards, regulations or clauses that are not written in the documents.

Use confidence "low" when the text is ambiguous.
Do not invent or cite regulatory requirements, rule numbers, clause numbers or standards that are not written in the documents. Do not judge legal compliance.`;

function uncertaintyOf(confidence: "high" | "medium" | "low", citations: CheckedCitation[]): Uncertainty {
  if (citations.some((c) => c.check === "not_found" || c.check === "unknown_file")) return "high";
  if (confidence === "low") return "high";
  if (confidence === "medium" || citations.some((c) => c.check === "verified_other_page")) return "medium";
  return "low";
}

/** Convert model (or hand-written demo) output into items, verifying every quotation against the text. */
export function toItems(out: ModelOutput, docs: UploadedDocument[], runId: string): AnalysisItem[] {
  const items: AnalysisItem[] = [];
  out.facts.forEach((f, i) => {
    const citations = [checkCitation(f.citation, docs)];
    const iso = f.normalized_date && /^\d{4}-\d{2}-\d{2}$/.test(f.normalized_date) ? f.normalized_date : null;
    items.push({
      id: `${runId}-f${i}`,
      kind: "fact",
      category: f.category,
      field: f.label,
      value: f.value,
      citations,
      modelConfidence: f.confidence,
      uncertainty: uncertaintyOf(f.confidence, citations),
      // Keep the normalised date only if the quotation really contains that date.
      normalizedDate: iso && dateAppearsInQuote(iso, f.citation.quote) ? iso : null,
    });
  });
  out.inconsistencies.forEach((x, i) => {
    const citations = x.citations.map((c) => checkCitation(c, docs));
    items.push({
      id: `${runId}-i${i}`,
      kind: "inconsistency",
      category: "inconsistency",
      field: x.topic,
      value: x.explanation,
      citations,
      modelConfidence: x.confidence,
      uncertainty: uncertaintyOf(x.confidence, citations),
    });
  });
  out.missing_information.forEach((m, i) => {
    items.push({
      id: `${runId}-m${i}`,
      kind: "missing",
      category: "missing",
      field: m.topic,
      value: m.explanation,
      citations: [],
      modelConfidence: m.confidence,
      // An absence can't be quoted, so it always needs a human check.
      uncertainty: m.confidence === "high" ? "medium" : "high",
    });
  });
  return items;
}

/** The AI request alone: returns the model's validated proposal, before any code verification. */
export async function requestAnalysis(docs: UploadedDocument[], trace?: AiTrace) {
  if (docs.length === 0) {
    throw new AnalysisError("no_documents", 400, "No uploaded documents with extractable text in this workspace.");
  }
  const { prompt, sent } = buildDocumentsPrompt(docs);
  const { data, model, usage } = await generateStructured(ModelOutputSchema, SYSTEM_INSTRUCTION, prompt, trace);
  return { data, model, usage, sent };
}

export async function analyzeDocuments(
  workspaceId: string,
  docs: UploadedDocument[],
  skipped: AnalysisResult["skipped"],
  runId: string = randomUUID().slice(0, 8),
  trace?: AiTrace,
): Promise<AnalysisResult> {
  const { data, model, usage, sent } = await requestAnalysis(docs, trace);
  return {
    runId,
    workspaceId,
    source: "gemini",
    model,
    createdAt: new Date().toISOString(),
    documents: sent,
    skipped,
    items: toItems(data, docs, runId),
    usage,
  };
}
