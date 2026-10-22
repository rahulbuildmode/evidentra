import { z } from "zod";
import { CitationSchema, type CheckedCitation } from "./analysis";

/** Requirement-to-evidence mapping: shared by client and server (no Node imports). */

export const EVIDENCE_STATUS = ["found", "partial", "missing", "conflicting", "needs_review"] as const;
export type EvidenceStatus = (typeof EVIDENCE_STATUS)[number];

/** Labels for statuses proposed by the AI or demo seed. "missing" from the AI only means not found. */
export const EVIDENCE_LABEL: Record<EvidenceStatus, string> = {
  found: "Evidence found",
  partial: "Partial evidence",
  missing: "Not found in uploaded documents",
  conflicting: "Conflicting evidence",
  needs_review: "Needs closer review",
};

export const MappingOutputSchema = z.object({
  rows: z
    .array(
      z.object({
        requirement_id: z.string().min(1).max(80),
        status: z.enum(EVIDENCE_STATUS),
        rationale: z.string().min(1).max(1200),
        next_action: z.string().min(1).max(600),
        citations: z.array(CitationSchema).max(4),
      }),
    )
    .max(40),
});
export type MappingOutput = z.infer<typeof MappingOutputSchema>;

export interface MappingRow {
  requirementId: string;
  /** Final status after code rules. */
  status: EvidenceStatus;
  /** What the AI (or demo seed) proposed before code rules. Null if it did not assess the item. */
  proposedStatus: EvidenceStatus | null;
  rationale: string;
  nextAction: string;
  citations: CheckedCitation[];
  /** Explanation when code changed the status or flagged a citation. */
  codeNote: string | null;
}

export interface MappingResult {
  runId: string;
  workspaceId: string;
  requirementSetId: string;
  source: "gemini" | "demo-seed";
  model: string | null;
  createdAt: string;
  documents: string[];
  rows: MappingRow[];
}

/**
 * Code rules on top of the AI proposal, so a status is never stronger than its verified evidence:
 * - found / partial need at least one quotation verified in the extracted text;
 * - conflicting needs at least two verified quotations;
 * - missing is always worded as "not found in the uploaded text", never as proof of absence.
 */
export function applyEvidenceRules(
  proposed: EvidenceStatus,
  citations: CheckedCitation[],
): { status: EvidenceStatus; codeNote: string | null } {
  const verified = citations.filter((c) => c.verifiedPage !== null).length;
  const unverified = citations.length - verified;
  const notes: string[] = [];
  let status = proposed;
  if ((proposed === "found" || proposed === "partial") && verified < 1) {
    status = "needs_review";
    notes.push(`Proposed "${proposed}" but no cited passage could be verified in the extracted text.`);
  }
  if (proposed === "conflicting" && verified < 2) {
    status = "needs_review";
    notes.push("Proposed \"conflicting\" but fewer than two cited passages could be verified.");
  }
  if (status === "missing") {
    notes.push("Not found in the uploaded text. This is not proof that the evidence does not exist.");
  }
  if (unverified > 0) notes.push(`${unverified} cited passage(s) could not be verified and must not be relied on.`);
  return { status, codeNote: notes.length ? notes.join(" ") : null };
}
