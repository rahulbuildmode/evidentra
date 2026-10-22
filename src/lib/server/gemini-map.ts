import { randomUUID } from "node:crypto";
import { applyEvidenceRules, MappingOutputSchema, type MappingOutput, type MappingResult, type MappingRow } from "../mapping";
import type { RequirementSet } from "../requirements";
import type { UploadedDocument } from "../uploads";
import { AnalysisError, buildDocumentsPrompt, generateStructured, UNTRUSTED_TEXT_RULES, type AiTrace } from "./gemini-common";
import { checkCitation } from "./verify-quotes";

const SYSTEM_INSTRUCTION = `You help regulatory affairs and quality staff check whether uploaded documentation contains the evidence each listed requirement expects. A human makes every final decision.

${UNTRUSTED_TEXT_RULES}

For EVERY requirement in <requirements>, return one row with requirement_id copied exactly, and:
- status:
  - "found": a passage actually contains the expected evidence content. A document title, file name or a mere mention is NOT enough.
  - "partial": some of the expected content is present, but parts are missing, incomplete or marked as not done.
  - "conflicting": passages that bear on this requirement contradict each other (e.g. different model numbers). Cite each conflicting passage.
  - "missing": you found no passage with the expected evidence in the provided text. This only means "not found in the uploaded text".
  - "needs_review": unclear, or the text is insufficient to judge.
- rationale: one or two neutral sentences explaining the status. Never state that a requirement is legally met or violated.
- next_action: one concrete step for a human reviewer (e.g. "Confirm which model number is correct and align the IFU").
- citations: up to 4 supporting passages (empty for "missing").

Only use the requirements given. Do not add requirements, rule numbers or standards that are not in the input.`;

function requirementsBlock(set: RequirementSet): string {
  return JSON.stringify(
    set.requirements.map((r) => ({ id: r.id, title: r.title, expected_evidence: r.expectedEvidence })),
    null,
    1,
  );
}

/** Turn proposed rows (AI or demo seed) into final rows: verify quotes, apply code rules, fill gaps. */
export function finalizeRows(set: RequirementSet, out: MappingOutput, docs: UploadedDocument[]): MappingRow[] {
  return set.requirements.map((req) => {
    const proposed = out.rows.find((r) => r.requirement_id === req.id);
    if (!proposed) {
      return {
        requirementId: req.id,
        status: "needs_review",
        proposedStatus: null,
        rationale: "The AI did not assess this requirement.",
        nextAction: "Review the documents for this requirement manually.",
        citations: [],
        codeNote: "No proposal was returned for this item.",
      };
    }
    const citations = proposed.citations.map((c) => checkCitation(c, docs));
    const { status, codeNote } = applyEvidenceRules(proposed.status, citations);
    return {
      requirementId: req.id,
      status,
      proposedStatus: proposed.status,
      rationale: proposed.rationale,
      nextAction: proposed.next_action,
      citations,
      codeNote,
    };
  });
}

export async function mapRequirements(
  workspaceId: string,
  set: RequirementSet,
  docs: UploadedDocument[],
  runId: string = randomUUID().slice(0, 8),
  trace?: AiTrace,
): Promise<MappingResult> {
  if (docs.length === 0) {
    throw new AnalysisError("no_documents", 400, "No uploaded documents with extractable text in this workspace.");
  }
  const { prompt } = buildDocumentsPrompt(docs);
  const full = `<requirements>\n${requirementsBlock(set)}\n</requirements>\n\n${prompt}`;
  const { data, model } = await generateStructured(MappingOutputSchema, SYSTEM_INSTRUCTION, full, trace);
  return {
    runId,
    workspaceId,
    requirementSetId: set.id,
    source: "gemini",
    model,
    createdAt: new Date().toISOString(),
    documents: docs.map((d) => d.filename),
    rows: finalizeRows(set, data, docs),
  };
}
