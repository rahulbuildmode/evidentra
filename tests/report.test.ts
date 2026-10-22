import { describe, expect, it } from "vitest";
import type { AnalysisResult } from "@/lib/analysis";
import { DEMO_STATE } from "@/lib/demo-data";
import type { MappingResult } from "@/lib/mapping";
import { buildReport } from "@/lib/report";
import { SYNTHETIC_DEMO_SET } from "@/lib/requirements";

const cite = (quote: string) => ({ filename: "a.pdf", claimedPage: 1, verifiedPage: 1, quote, check: "verified" as const });
const mapping: MappingResult = {
  runId: "r1", workspaceId: "demo-workspace", requirementSetId: SYNTHETIC_DEMO_SET.id, source: "gemini", model: "m", createdAt: "", documents: ["a.pdf"],
  rows: [
    { requirementId: "DEMO-04", status: "conflicting", proposedStatus: "conflicting", rationale: "r", nextAction: "fix", citations: [cite("A"), cite("B")], codeNote: null },
    { requirementId: "DEMO-05", status: "partial", proposedStatus: "partial", rationale: "r", nextAction: "complete", citations: [cite("C")], codeNote: null },
    { requirementId: "DEMO-06", status: "missing", proposedStatus: "missing", rationale: "r", nextAction: "find", citations: [], codeNote: null },
  ],
};
const analysis = { runId: "x", items: [], documents: [], skipped: [], usage: { promptTokens: null, outputTokens: null } } as unknown as AnalysisResult;
const base = { state: DEMO_STATE, set: SYNTHETIC_DEMO_SET, mapping, analysis, uploads: [], today: "2026-10-22" };

describe("buildReport", () => {
  it("counts statuses from the mapping, not hardcoded values", () => {
    const r = buildReport({ ...base, reviews: {} });
    expect(r.counts.evidence).toMatchObject({ conflicting: 1, partial: 1, missing: 1, not_assessed: 4 });
    expect(r.actions[0].priority).toBe(1);
    expect(r.actions[0].title).toMatch(/DEMO-04/);
  });
  it("applies human status changes and dismissals, and keeps them across a new run", () => {
    const r0 = buildReport({ ...base, reviews: {} });
    const k5 = r0.requirements.find((x) => x.requirement.id === "DEMO-05")!;
    const k6 = r0.requirements.find((x) => x.requirement.id === "DEMO-06")!;
    const reviews = {
      [k5.key]: { reviewed: true, decision: "undecided" as const, status: "found" as const, note: "", dismissedReason: null, basis: k5.basis, updatedAt: "" },
      [k6.key]: { reviewed: true, decision: "rejected" as const, status: null, note: "", dismissedReason: "evidence is in another dossier", basis: k6.basis, updatedAt: "" },
    };
    const rerun = { ...mapping, runId: "r2" };
    const r = buildReport({ ...base, mapping: rerun, reviews });
    expect(r.counts.evidence.partial).toBe(0);
    expect(r.counts.evidence.found).toBe(1);
    expect(r.counts.dismissed).toBe(1);
    expect(r.actions.some((a) => a.title.includes("DEMO-06"))).toBe(false);
    expect(r.counts.changedSinceReview).toBe(0);
  });
  it("flags reviews whose evidence changed", () => {
    const r0 = buildReport({ ...base, reviews: {} });
    const k = r0.requirements.find((x) => x.requirement.id === "DEMO-04")!;
    const reviews = { [k.key]: { reviewed: true, decision: "accepted" as const, status: null, note: "", dismissedReason: null, basis: "old", updatedAt: "" } };
    expect(buildReport({ ...base, reviews }).counts.changedSinceReview).toBe(1);
  });
});
