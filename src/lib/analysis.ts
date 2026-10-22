import { z } from "zod";

/**
 * Shapes for AI analysis. `ModelOutputSchema` is what Gemini must return (validated with Zod);
 * `AnalysisResult` is what the server stores and the UI shows after quote verification.
 * Shared by client and server — no Node imports.
 */

export const CONFIDENCE = ["high", "medium", "low"] as const;

export const FACT_CATEGORIES = [
  "device_name",
  "model_number",
  "manufacturer_name",
  "manufacturer_address",
  "intended_use",
  "technical_specification",
  "referenced_standard",
  "document_date",
  "document_revision",
] as const;

export type FactCategory = (typeof FACT_CATEGORIES)[number];

export const CATEGORY_LABEL: Record<FactCategory, string> = {
  device_name: "Device name",
  model_number: "Model number",
  manufacturer_name: "Manufacturer name",
  manufacturer_address: "Manufacturer address",
  intended_use: "Intended use",
  technical_specification: "Technical specification",
  referenced_standard: "Referenced standard",
  document_date: "Document date",
  document_revision: "Document revision",
};

/** Older saved results may use categories that no longer exist. */
export function categoryLabel(c: string): string {
  return (CATEGORY_LABEL as Record<string, string>)[c] ?? c.replace(/_/g, " ");
}

export const CitationSchema = z.object({
  filename: z.string().min(1).max(300),
  page: z.number().int().min(1).nullable(),
  quote: z.string().min(1).max(600),
});

export const ModelOutputSchema = z.object({
  facts: z
    .array(
      z.object({
        category: z.enum(FACT_CATEGORIES),
        label: z.string().min(1).max(200),
        value: z.string().min(1).max(1000),
        /** For date facts only: the same date as YYYY-MM-DD, else null. Checked against the quote by code. */
        normalized_date: z.string().nullable(),
        citation: CitationSchema,
        confidence: z.enum(CONFIDENCE),
      }),
    )
    .max(80),
  missing_information: z
    .array(
      z.object({
        topic: z.string().min(1).max(200),
        explanation: z.string().min(1).max(1000),
        confidence: z.enum(CONFIDENCE),
      }),
    )
    .max(30),
  inconsistencies: z
    .array(
      z.object({
        topic: z.string().min(1).max(200),
        explanation: z.string().min(1).max(1000),
        citations: z.array(CitationSchema).min(2).max(6),
        confidence: z.enum(CONFIDENCE),
      }),
    )
    .max(30),
});

export type ModelOutput = z.infer<typeof ModelOutputSchema>;

/** Result of checking a quotation against the real extracted text. Decided by code, not the model. */
export type QuoteCheck =
  | "verified" // found on the cited page
  | "verified_other_page" // found in the same file, but on a different page (page set by code)
  | "not_found" // not found anywhere in that file's extracted text
  | "unknown_file"; // the cited filename is not one of the uploaded documents

export interface CheckedCitation {
  filename: string;
  /** Page the model claimed. */
  claimedPage: number | null;
  /** Page where code actually found the quote (null if not found). */
  verifiedPage: number | null;
  quote: string;
  check: QuoteCheck;
}

export type Uncertainty = "low" | "medium" | "high";

export interface AnalysisItem {
  id: string;
  kind: "fact" | "inconsistency" | "missing";
  /** For facts: category key; for others: "inconsistency" / "missing". */
  category: FactCategory | "inconsistency" | "missing";
  field: string;
  /** Extracted value (facts) or explanation (inconsistencies / missing info). */
  value: string;
  citations: CheckedCitation[];
  modelConfidence: (typeof CONFIDENCE)[number];
  uncertainty: Uncertainty;
  /** Date facts: YYYY-MM-DD, kept only if code confirmed it appears in the quotation. */
  normalizedDate?: string | null;
}

export interface AnalysisResult {
  runId: string;
  workspaceId: string;
  /** "demo-seed" results were written by hand for the fictional demo (quotes still verified by code). */
  source?: "gemini" | "demo-seed";
  model: string;
  createdAt: string;
  documents: { id: string; filename: string; pageCount: number; charsSent: number; truncated: boolean }[];
  skipped: { filename: string; reason: string }[];
  items: AnalysisItem[];
  usage: { promptTokens: number | null; outputTokens: number | null };
}

export type AnalysisErrorCode =
  | "missing_key"
  | "invalid_key"
  | "quota"
  | "timeout"
  | "unavailable"
  | "model_not_found"
  | "malformed_output"
  | "blocked"
  | "no_documents"
  | "busy"
  | "bad_request";
