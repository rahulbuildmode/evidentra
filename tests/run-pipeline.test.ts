import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { ModelOutput } from "@/lib/analysis";
import type { MappingOutput } from "@/lib/mapping";
import { SYNTHETIC_DEMO_SET } from "@/lib/requirements";
import type { RunEvent } from "@/lib/run";
import type { AiTrace } from "@/lib/server/gemini-common";

/**
 * Pipeline tests with the Gemini network call replaced by a stub (the live API is not called).
 * Everything else is real: PDF extraction, storage, quote verification, checks, evidence rules, run records.
 */

const FILE = "tiny_text_test.pdf"; // page 1: "Model number: NT-100"; page 2: "Model: NT-110"

const PROPOSAL: ModelOutput = {
  facts: [
    { category: "model_number", label: "Model number", value: "NT-100", normalized_date: null, citation: { filename: FILE, page: 1, quote: "Model number: NT-100" }, confidence: "high" },
    // Real text, wrong page → code should correct it to page 2.
    { category: "model_number", label: "Model", value: "NT-110", normalized_date: null, citation: { filename: FILE, page: 1, quote: "Model: NT-110" }, confidence: "high" },
    // Not in the document at all.
    { category: "intended_use", label: "Intended use", value: "Children", normalized_date: null, citation: { filename: FILE, page: 2, quote: "approved for use in children" }, confidence: "low" },
    // File that was never uploaded.
    { category: "manufacturer_name", label: "Manufacturer", value: "Ghost Ltd", normalized_date: null, citation: { filename: "ghost.pdf", page: 1, quote: "Manufacturer: Ghost Ltd" }, confidence: "low" },
  ],
  inconsistencies: [
    {
      topic: "Model number",
      explanation: "Page 1 says NT-100, page 2 says NT-110.",
      citations: [
        { filename: FILE, page: 1, quote: "Model number: NT-100" },
        { filename: FILE, page: 2, quote: "Model: NT-110" },
      ],
      confidence: "high",
    },
  ],
  missing_information: [{ topic: "Specifications", explanation: "Not found in the uploaded documents.", confidence: "medium" }],
};

const MAPPING: MappingOutput = {
  rows: [{ requirement_id: SYNTHETIC_DEMO_SET.requirements[0].id, status: "found", rationale: "r", next_action: "n", citations: [{ filename: FILE, page: 1, quote: "invented passage" }] }],
};

const behaviour: { analysis: "ok" | "quota"; mapping: "ok" | "quota" } = { analysis: "ok", mapping: "ok" };

vi.mock("@/lib/server/gemini-common", async (orig) => {
  const real = await orig<typeof import("@/lib/server/gemini-common")>();
  return {
    ...real,
    generateStructured: async (_s: unknown, _sys: string, _p: string, trace?: AiTrace) => {
      const stage = trace?.stage ?? "analysis";
      trace!.model = "stub-model";
      trace!.onRequest?.(1);
      const fail = behaviour[stage] === "quota";
      const a = {
        stage,
        attempt: 1,
        startedAt: new Date().toISOString(),
        durationMs: 5,
        outcome: fail ? ("error" as const) : ("ok" as const),
        httpStatus: fail ? 429 : 200,
        note: fail ? "quota" : null,
        promptTokens: fail ? null : 123,
        outputTokens: fail ? null : 45,
      };
      trace!.attempts.push(a);
      trace!.onAttempt?.(a);
      if (fail) throw new real.AnalysisError("quota", 429, "The Gemini API key has used up its quota.");
      const data = stage === "analysis" ? PROPOSAL : MAPPING;
      trace!.output = data;
      return { data, model: "stub-model", usage: { promptTokens: 123, outputTokens: 45 } };
    },
  };
});

let dir = "";
const WS = "ws-test-pipeline";

beforeAll(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), "evidentra-test-"));
  process.env.EVIDENTRA_DATA_DIR = dir;
  const { ingestPdf } = await import("@/lib/server/ingest");
  await ingestPdf(WS, FILE, new Uint8Array(await readFile(path.join(process.cwd(), "fixtures", FILE))), "user");
  await ingestPdf(WS, "blank_scan_no_text.pdf", new Uint8Array(await readFile(path.join(process.cwd(), "fixtures", "blank_scan_no_text.pdf"))), "user");
});
afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});
beforeEach(async () => {
  behaviour.analysis = "ok";
  behaviour.mapping = "ok";
  const { clearResults } = await import("@/lib/server/analysis-store");
  await clearResults(WS);
});

async function run() {
  const { RunRecorder } = await import("@/lib/server/run-recorder");
  const { runLivePipeline } = await import("@/lib/server/run-pipeline");
  const events: RunEvent[] = [];
  const rec = new RunRecorder(WS, "live", SYNTHETIC_DEMO_SET.id, (e) => events.push(e));
  await runLivePipeline(rec, WS, SYNTHETIC_DEMO_SET);
  const record = await rec.end();
  return { record, events };
}

describe("live pipeline (Gemini stubbed)", () => {
  it("records every step, skips the scanned file with its reason, and counts real request tokens", async () => {
    const { record, events } = await run();
    expect(record.status).toBe("completed");
    expect(record.steps.map((s) => s.status)).toEqual(Array(8).fill("completed"));
    for (const s of record.steps) expect(s.durationMs).not.toBeNull();
    const skipped = record.documents.find((d) => !d.included)!;
    expect(skipped.filename).toBe("blank_scan_no_text.pdf");
    expect(skipped.reason).toMatch(/OCR may be required/);
    expect(record.documents.find((d) => d.included)!.extractMs).toEqual(expect.any(Number));
    expect(record.ai.map((a) => a.attempts.length)).toEqual([1, 1]);
    expect(record.ai[0].attempts[0].promptTokens).toBe(123);
    // Original proposal kept as returned.
    expect(record.ai[0].output).toEqual(PROPOSAL);
    // Events are numbered without gaps.
    expect(events.map((e) => e.seq)).toEqual(events.map((_, i) => i + 1));
  });

  it("verifies quotations with the real verifier: verified, other page, not found, unknown file", async () => {
    const { record } = await run();
    const fromAnalysis = record.quotes.filter((q) => q.source === "analysis");
    const byQuote = Object.fromEntries(fromAnalysis.map((q) => [q.quote, q]));
    expect(byQuote["Model number: NT-100"].check).toBe("verified");
    expect(fromAnalysis.find((q) => q.quote === "Model: NT-110" && q.proposedPage === 1)).toMatchObject({ check: "verified_other_page", verifiedPage: 2 });
    expect(fromAnalysis.find((q) => q.quote === "Model: NT-110" && q.proposedPage === 2)?.check).toBe("verified");
    expect(byQuote["approved for use in children"].check).toBe("not_found");
    expect(byQuote["Manufacturer: Ghost Ltd"].check).toBe("unknown_file");
    expect(record.quotes.find((q) => q.source === "mapping")?.check).toBe("not_found");
  });

  it("records the deterministic checks actually executed, with outcomes", async () => {
    const { record } = await run();
    const model = record.checks.find((c) => c.field === "Model number")!;
    expect(model.outcome).toBe("differs");
    expect(model.compared.map((c) => c.value).sort()).toEqual(["NT-100", "NT-110"]);
    // Only one verified device-name/manufacturer value → those comparisons are not run, so not counted.
    expect(record.checks.some((c) => c.field === "Manufacturer name")).toBe(false);
  });

  it("caps the mapping status when its only quotation is not found", async () => {
    await run();
    const { getMapping } = await import("@/lib/server/analysis-store");
    const row = (await getMapping(WS))!.rows[0];
    expect(row.proposedStatus).toBe("found");
    expect(row.status).toBe("needs_review");
  });

  it("on a quota error in AI request 1: marks it failed, skips the rest, saves no analysis", async () => {
    behaviour.analysis = "quota";
    const { record } = await run();
    expect(record.status).toBe("failed");
    expect(record.failure).toMatchObject({ step: "ai_analysis", code: "quota" });
    expect(record.steps.find((s) => s.key === "ai_analysis")!.status).toBe("failed");
    for (const k of ["verification", "checks", "ai_mapping", "validation", "save"]) {
      const s = record.steps.find((x) => x.key === k)!;
      expect(s.status).toBe("skipped");
      expect(s.durationMs).toBeNull();
    }
    expect(record.ai[0].attempts[0].promptTokens).toBeNull();
    expect(record.findings).toBeNull();
    const { getAnalysis } = await import("@/lib/server/analysis-store");
    expect(await getAnalysis(WS)).toBeNull();
  });

  it("on a quota error in AI request 2: keeps the verified analysis and says the mapping failed", async () => {
    behaviour.mapping = "quota";
    const { record } = await run();
    expect(record.status).toBe("failed");
    expect(record.failure?.step).toBe("ai_mapping");
    expect(record.steps.find((s) => s.key === "save")!.status).toBe("completed");
    expect(record.steps.find((s) => s.key === "save")!.note).toMatch(/mapping was not saved/);
    const { getAnalysis, getMapping } = await import("@/lib/server/analysis-store");
    expect((await getAnalysis(WS))?.runId).toBe(record.runId);
    expect(await getMapping(WS)).toBeNull();
  });
});

describe("CDSCO validation inside the run", () => {
  it("records a validation step and saves a report built from this run's verified results", async () => {
    const { record } = await run();
    expect(record.steps.find((s) => s.key === "validation")?.status).toBe("completed");
    expect(record.validation?.counts).toBeTruthy();
    const { getSavedValidation } = await import("@/lib/server/analysis-store");
    const report = (await getSavedValidation(WS))!;
    expect(report.inputs.analysis?.runId).toBe(record.runId);
    // No device profile was entered → applicability stays unresolved instead of being assumed.
    expect(report.decision.status).toBe("unresolved");
    // The model-number conflict between page 1 (NT-100) and page 2 (NT-110) is detected by code.
    expect(report.results.find((r) => r.requirementId === "MDR-4S-AppII-2.1")?.deterministic[0]?.outcome).toBe("failed");
  });
});

describe("run storage isolation", () => {
  it("a run id from one workspace is not readable from another, and bad ids are refused", async () => {
    const { record } = await run();
    const { getRun, listRuns } = await import("@/lib/server/run-recorder");
    expect((await getRun(WS, record.runId))?.runId).toBe(record.runId);
    expect(await getRun("ws-someone-else", record.runId)).toBeNull();
    expect(await getRun(WS, "../analyses/ws-test-pipeline")).toBeNull();
    expect(await listRuns("ws-someone-else")).toEqual([]);
  });

  it("12. another workspace cannot read this workspace's documents or validation inputs", async () => {
    const { listDocuments, getDocument } = await import("@/lib/server/document-store");
    const { buildValidation } = await import("@/lib/server/validation");
    const mine = await listDocuments(WS);
    expect(mine.length).toBeGreaterThan(0);
    expect(await getDocument("ws-someone-else", mine[0].id)).toBeNull();
    const other = await buildValidation("ws-someone-else");
    expect(other.inputs.documentsReviewed).toEqual([]);
    expect(other.inputs.analysis).toBeNull();
  });

  it("a saved run keeps its original timestamps", async () => {
    const { record } = await run();
    await new Promise((r) => setTimeout(r, 20));
    const { getRun } = await import("@/lib/server/run-recorder");
    const again = await getRun(WS, record.runId);
    expect(again?.startedAt).toBe(record.startedAt);
    expect(again?.events[0].at).toBe(record.events[0].at);
  });
});
