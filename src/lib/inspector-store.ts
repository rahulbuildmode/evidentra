"use client";

import { useSyncExternalStore } from "react";
import type { QuoteCheck } from "./analysis";
import { caseLog } from "./case-log";
import type { RequirementResult } from "./regulatory/types";
import type { ReportFinding } from "./report";

/** One quotation as proposed (by the AI, the demo seed or a verification test) and as checked by code. */
export interface QuoteTarget {
  origin: "AI proposal" | "Demo seed" | "Verification test" | "Located by code";
  context: string;
  quote: string;
  proposedFilename: string;
  proposedPage: number | null;
  check: QuoteCheck | null;
  verifiedPage: number | null;
  /** Workspace whose documents the quote refers to (the proof tests use their own). */
  workspaceId: string;
}

export type InspectTarget =
  | { kind: "quote"; quote: QuoteTarget }
  | { kind: "finding"; finding: ReportFinding; workspaceId: string }
  | { kind: "requirement"; result: RequirementResult; workspaceId: string; synthetic: boolean };

let target: InspectTarget | null = null;
const listeners = new Set<() => void>();

export const inspector = {
  open(t: InspectTarget) {
    target = t;
    // Log a genuine action for case progress: opening a quotation that code found in the text.
    const at = new Date().toISOString();
    if (t.kind === "quote" && t.quote.verifiedPage !== null && (t.quote.check === "verified" || t.quote.check === "verified_other_page"))
      caseLog.record(t.quote.workspaceId, { inspectedVerifiedQuote: { at, filename: t.quote.proposedFilename, page: t.quote.verifiedPage } });
    if (t.kind === "finding") {
      const c = t.finding.citations.find((x) => x.verified);
      if (c) caseLog.record(t.workspaceId, { inspectedVerifiedQuote: { at, filename: c.filename, page: c.page } });
    }
    listeners.forEach((l) => l());
  },
  close() {
    target = null;
    listeners.forEach((l) => l());
  },
};

export function useInspectTarget(): InspectTarget | null {
  return useSyncExternalStore(
    (cb) => (listeners.add(cb), () => listeners.delete(cb)),
    () => target,
    () => null,
  );
}
