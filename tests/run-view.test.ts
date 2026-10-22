import { describe, expect, it } from "vitest";
import { locateQuote } from "@/lib/highlight";
import type { RunEvent } from "@/lib/run";
import { applyEvents, emptyView, parseSse } from "@/lib/run-view";

const ev = (seq: number, type: RunEvent["type"], extra: Partial<RunEvent> = {}): RunEvent => ({
  seq,
  runId: "run-a",
  type,
  at: `2026-10-22T10:00:0${seq}.000Z`,
  ...extra,
});

const EVENTS: RunEvent[] = [
  ev(1, "run_started"),
  ev(2, "step_started", { step: "documents" }),
  ev(3, "step_completed", { step: "documents", data: { durationMs: 4 } }),
  ev(4, "step_started", { step: "ai_analysis" }),
  ev(5, "step_failed", { step: "ai_analysis", message: "quota", data: { durationMs: 500, code: "quota" } }),
  ev(6, "step_skipped", { step: "save", message: "Not run" }),
  ev(7, "run_failed", { data: { durationMs: 510 } }),
];

describe("applyEvents", () => {
  it("builds step states from server events only", () => {
    const v = applyEvents(emptyView(), EVENTS);
    expect(v.runId).toBe("run-a");
    expect(v.steps.documents).toMatchObject({ status: "completed", durationMs: 4 });
    expect(v.steps.ai_analysis).toMatchObject({ status: "failed", durationMs: 500 });
    expect(v.steps.save).toMatchObject({ status: "skipped", durationMs: null });
    expect(v.steps.checks.status).toBe("pending");
    expect(v.failure).toMatchObject({ step: "ai_analysis", code: "quota" });
    expect(v).toMatchObject({ status: "failed", durationMs: 510 });
  });

  it("ignores duplicate deliveries after a reconnect and handles out-of-order delivery", () => {
    const once = applyEvents(emptyView(), EVENTS);
    const replayed = applyEvents(applyEvents(emptyView(), EVENTS.slice(0, 4)), [...EVENTS].reverse());
    expect(replayed.events.map((e) => e.seq)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(replayed.steps).toEqual(once.steps);
    expect(applyEvents(once, EVENTS)).toBe(once); // nothing new → same object
  });

  it("ignores events from a different run", () => {
    const v = applyEvents(applyEvents(emptyView(), EVENTS.slice(0, 2)), [{ ...ev(3, "step_completed", { step: "documents" }), runId: "run-b" }]);
    expect(v.steps.documents.status).toBe("running");
  });
});

describe("parseSse", () => {
  it("parses complete frames and keeps a partial frame for the next chunk", () => {
    const text = `id: 1\ndata: ${JSON.stringify(EVENTS[0])}\n\nid: 2\ndata: ${JSON.stringify(EVENTS[1]).slice(0, 10)}`;
    const r = parseSse(text);
    expect(r.events).toHaveLength(1);
    expect(r.rest.startsWith("id: 2")).toBe(true);
    const r2 = parseSse(`event: error\ndata: {"code":"busy","error":"Already running"}\n\n`);
    expect(r2.errors[0].code).toBe("busy");
  });
});

describe("locateQuote", () => {
  const page = "Device name: Nova Thermometer\nModel number:\nNT-100\nManufacturer: Example";
  it("highlights an exact match or the same text across line breaks", () => {
    expect(locateQuote(page, "Device name: Nova Thermometer")).toEqual([0, 29]);
    const hit = locateQuote(page, "Model number: NT-100")!;
    expect(page.slice(hit[0], hit[1])).toBe("Model number:\nNT-100");
  });
  it("never highlights similar but different wording", () => {
    expect(locateQuote(page, "Model number: NT-110")).toBeNull();
    expect(locateQuote(page, "device name: nova thermometer")).toBeNull();
  });
});
