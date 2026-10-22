import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { crossCheck } from "@/lib/checks";
import { BLANK_WORKSPACE } from "@/lib/demo-data";
import { relatedRequirements } from "@/lib/links";

/**
 * The demo moment end to end on the server code (no AI): load the synthetic dossier → the planted
 * AP-200A vs AP-2000A discrepancy is found by code → it links to CDSCO requirements with a next action.
 */
let dir = "";
const saved = { ...process.env };
beforeAll(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), "evidentra-demo-"));
  process.env.EVIDENTRA_DATA_DIR = dir;
  delete process.env.BLOB_READ_WRITE_TOKEN;
});
afterAll(async () => {
  process.env = { ...saved };
  await rm(dir, { recursive: true, force: true });
});

describe("synthetic demo: discrepancy → evidence → requirement", () => {
  it("finds the planted model-number conflict with verified quotations and links it to requirements", async () => {
    const { loadDemo, DEMO_WORKSPACE_ID } = await import("@/lib/server/demo-loader");
    const { getAnalysis } = await import("@/lib/server/analysis-store");
    const { buildValidation } = await import("@/lib/server/validation");

    const loaded = await loadDemo();
    expect(loaded.documents).toBe(4);
    expect(loaded.unverifiedQuotes).toBe(0);

    const analysis = await getAnalysis(DEMO_WORKSPACE_ID);
    const conflict = crossCheck(analysis, BLANK_WORKSPACE, "2026-10-22").find((f) => f.id === "cc-model_number-mismatch")!;
    expect(conflict).toBeTruthy();
    expect(new Set(conflict.citations.map((c) => c.value))).toEqual(new Set(["AP-200A", "AP-2000A"]));
    expect(conflict.citations.map((c) => c.filename)).toContain("02_instructions_for_use.pdf");

    const report = await buildValidation(DEMO_WORKSPACE_ID);
    expect(report.synthetic).toBe(true);
    const linked = relatedRequirements(conflict, report);
    expect(linked.map((r) => r.requirementId)).toEqual(expect.arrayContaining(["MDR-4S-AppII-2.1", "MDR-4S-AppII-3.0"]));
    for (const r of linked.filter((x) => x.requirementId.startsWith("MDR-4S-AppII-"))) {
      expect(r.status).toBe("conflict_detected");
      expect(r.nextAction.length).toBeGreaterThan(10);
      expect(r.sourceUrl.startsWith("https://cdsco.gov.in/")).toBe(true);
    }
  });
});
