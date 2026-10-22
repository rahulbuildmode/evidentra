import { describe, expect, it } from "vitest";
import { achievements, missionTasks, type CaseInputs } from "@/lib/case-progress";

const base: CaseInputs = { readableDocs: 0, pathwayInScope: false, analysis: null, leads: [], checks: [], log: {} };
const done = (c: CaseInputs) => missionTasks(c).filter((t) => t.done).map((t) => t.id);
const earned = (c: CaseInputs) => achievements(c).filter((a) => a.earned).map((a) => a.id);

describe("case progress reflects real work only", () => {
  it("starts with nothing done and nothing earned", () => {
    expect(done(base)).toEqual([]);
    expect(earned(base)).toEqual([]);
  });

  it("a demo seed completes the scan task but does not earn the AI scan achievement", () => {
    const c = { ...base, readableDocs: 4, analysis: { source: "demo-seed" as const, runId: "demo" } };
    expect(done(c)).toContain("scan");
    expect(earned(c)).not.toContain("scan");
    expect(missionTasks(c).find((t) => t.id === "scan")?.detail).toMatch(/no AI scan/);
  });

  it("leads must all be reviewed; an empty board only counts after a scan", () => {
    const leads = [
      { key: "a", reviewed: true },
      { key: "b", reviewed: false },
    ];
    const c = { ...base, analysis: { source: "gemini" as const, runId: "r1" }, leads };
    expect(done(c)).not.toContain("leads");
    expect(earned(c)).toEqual(["scan", "first-lead"]);
    expect(done({ ...c, leads: leads.map((l) => ({ ...l, reviewed: true })) })).toContain("leads");
    expect(done({ ...base, leads: [] })).not.toContain("leads");
    expect(done({ ...c, leads: [] })).toContain("leads");
  });

  it("source, checklist and export come from recorded actions and reviews", () => {
    const c: CaseInputs = {
      ...base,
      checks: [{ id: "x", reviewed: true }],
      log: { inspectedVerifiedQuote: { at: "t", filename: "a.pdf", page: 2 }, exported: { at: "t", kind: "csv" } },
    };
    expect(earned(c)).toEqual(expect.arrayContaining(["source", "checklist", "filed"]));
    expect(missionTasks(c).find((t) => t.id === "inspect")?.detail).toBe("Opened a.pdf, p.2");
  });
});
