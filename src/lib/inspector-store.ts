"use client";

import { useSyncExternalStore } from "react";
import type { QuoteCheck } from "./analysis";
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
