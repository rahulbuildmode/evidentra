import { STEP_KEYS, type RunEvent, type StepKey, type StepStatus } from "./run";

/** What the live trace shows, built only from server events. Shared by the live stream, reconnects and replays. */
export interface RunView {
  runId: string | null;
  startedAt: string | null;
  endedAt: string | null;
  durationMs: number | null;
  status: "running" | "completed" | "failed";
  steps: Record<StepKey, { status: StepStatus; startedAt: string | null; durationMs: number | null; note: string | null }>;
  events: RunEvent[];
  failure: { step: StepKey | null; code: string | null; message: string } | null;
}

export function emptyView(): RunView {
  return {
    runId: null,
    startedAt: null,
    endedAt: null,
    durationMs: null,
    status: "running",
    steps: Object.fromEntries(STEP_KEYS.map((k) => [k, { status: "pending", startedAt: null, durationMs: null, note: null }])) as RunView["steps"],
    events: [],
    failure: null,
  };
}

const num = (v: unknown) => (typeof v === "number" ? v : null);

/**
 * Apply events in sequence order. Events already seen (same run, same seq) are ignored, so a
 * reconnect that re-delivers events cannot duplicate them or move a step backwards.
 */
export function applyEvents(view: RunView, incoming: RunEvent[]): RunView {
  const seen = new Set(view.events.map((e) => e.seq));
  const fresh = incoming
    .filter((e) => (view.runId === null || e.runId === view.runId) && !seen.has(e.seq))
    .sort((a, b) => a.seq - b.seq);
  if (fresh.length === 0) return view;
  const v: RunView = { ...view, steps: { ...view.steps }, events: [...view.events, ...fresh].sort((a, b) => a.seq - b.seq) };
  // Rebuild from the full ordered list so out-of-order delivery still ends in the right state.
  const base = emptyView();
  Object.assign(v, { steps: base.steps, failure: null, status: "running", endedAt: null, durationMs: null });
  for (const e of v.events) {
    v.runId ??= e.runId;
    const s = e.step ? (v.steps[e.step] = { ...v.steps[e.step] }) : null;
    switch (e.type) {
      case "run_started":
        v.startedAt = e.at;
        break;
      case "step_started":
        if (s) Object.assign(s, { status: "running", startedAt: e.at, note: e.message ?? null });
        break;
      case "step_completed":
        if (s) Object.assign(s, { status: "completed", durationMs: num(e.data?.durationMs), note: e.message ?? null });
        break;
      case "step_failed":
        if (s) Object.assign(s, { status: "failed", durationMs: num(e.data?.durationMs), note: e.message ?? null });
        v.failure = { step: e.step ?? null, code: typeof e.data?.code === "string" ? e.data.code : null, message: e.message ?? "Step failed" };
        break;
      case "step_skipped":
        if (s) Object.assign(s, { status: "skipped", note: e.message ?? null });
        break;
      case "run_completed":
      case "run_failed":
        v.status = e.type === "run_completed" ? "completed" : "failed";
        v.endedAt = e.at;
        v.durationMs = num(e.data?.durationMs);
        break;
    }
  }
  return v;
}

/** Parse complete SSE frames from a text buffer; returns events and the unconsumed remainder. */
export function parseSse(buffer: string): { events: RunEvent[]; errors: { code: string; error: string }[]; rest: string } {
  const frames = buffer.split("\n\n");
  const rest = frames.pop() ?? "";
  const events: RunEvent[] = [];
  const errors: { code: string; error: string }[] = [];
  for (const f of frames) {
    const lines = f.split("\n");
    const type = lines.find((l) => l.startsWith("event:"))?.slice(6).trim();
    const data = lines.filter((l) => l.startsWith("data:")).map((l) => l.slice(5).trim()).join("\n");
    if (!data) continue;
    try {
      const j = JSON.parse(data);
      if (type === "error") errors.push(j);
      else if (typeof j?.seq === "number" && typeof j?.runId === "string") events.push(j as RunEvent);
    } catch {
      /* ignore a malformed frame */
    }
  }
  return { events, errors, rest };
}
