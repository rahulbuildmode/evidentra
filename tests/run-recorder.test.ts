import { describe, expect, it, vi } from "vitest";

/** Run saves are coalesced: one write in flight at a time, and the final state is always written. */
const state = { inFlight: 0, maxInFlight: 0, writes: 0, last: null as null | { status: string; steps: { status: string }[] } };

vi.mock("@/lib/server/storage", async (orig) => {
  const real = await orig<typeof import("@/lib/server/storage")>();
  return {
    ...real,
    writeJson: async (_key: string, value: { status: string; steps: { status: string }[] }) => {
      state.inFlight++;
      state.maxInFlight = Math.max(state.maxInFlight, state.inFlight);
      state.writes++;
      await new Promise((r) => setTimeout(r, 10));
      state.last = value;
      state.inFlight--;
    },
  };
});

describe("RunRecorder persistence", () => {
  it("never overlaps writes, coalesces bursts and lands the last state", async () => {
    const { RunRecorder } = await import("@/lib/server/run-recorder");
    const rec = new RunRecorder("ws-coalesce", "live", null);
    for (const k of ["documents", "extraction", "ai_analysis", "verification", "checks"] as const) {
      rec.start(k);
      rec.complete(k);
    }
    await rec.end();
    expect(state.maxInFlight).toBe(1);
    expect(state.writes).toBeLessThan(11); // 10 step changes + end, coalesced into fewer writes
    expect(state.last?.status).toBe("completed");
    expect(state.last?.steps.filter((s) => s.status === "completed")).toHaveLength(5);
  });
});
