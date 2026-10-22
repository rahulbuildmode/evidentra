"use client";

import { useSyncExternalStore } from "react";
import type { RunRecord, RunSummary } from "./run";
import { applyEvents, emptyView, parseSse, type RunView } from "./run-view";
import { refreshShared, useShared } from "./shared-fetch";

/**
 * The run currently shown in the Engine Room:
 * - "live": events streamed from the server as the pipeline runs;
 * - "replay": a saved run's recorded events played back at their recorded offsets (SAVED RUN — NOT LIVE).
 * Nothing here creates events; it only displays what the server recorded.
 */
export interface RunSession {
  mode: "live" | "replay";
  workspaceId: string;
  view: RunView;
  /** live: connection state. "reconnecting" = stream ended early, reading the saved run instead. */
  connection: "connecting" | "streaming" | "reconnecting" | "closed" | "lost";
  error: string | null;
  /** The full saved record once the run has ended (for inspectors). */
  record: RunRecord | null;
  /** Browser time when this session began (only for an "elapsed" display while the server is working). */
  clientStart: number;
}

let session: RunSession | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
let token = 0;

function update(t: number, fn: (s: RunSession) => RunSession) {
  if (t !== token || !session) return;
  session = fn(session);
  emit();
}

export function useRunSession(): RunSession | null {
  return useSyncExternalStore(
    (cb) => (listeners.add(cb), () => listeners.delete(cb)),
    () => session,
    () => null,
  );
}

async function getRun(workspaceId: string, runId: string): Promise<RunRecord | null> {
  const res = await fetch(`/api/runs/${encodeURIComponent(runId)}?workspaceId=${encodeURIComponent(workspaceId)}`);
  if (!res.ok) return null;
  return ((await res.json()) as { run: RunRecord }).run;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const ended = (v: RunView) => v.status !== "running";

async function finish(t: number, workspaceId: string, runId: string | null) {
  const record = runId ? await getRun(workspaceId, runId).catch(() => null) : null;
  update(t, (s) => ({ ...s, record, connection: "closed" }));
  await Promise.all([refreshShared(`results:${workspaceId}`), refreshShared(`runs:${workspaceId}`), refreshShared(`uploads:${workspaceId}`)]);
}

export const runActions = {
  clear() {
    token++;
    session = null;
    emit();
  },

  /** Start a live run and follow its server-sent events. */
  async startLive(workspaceId: string, requirementSetId: string | null) {
    const t = ++token;
    session = { mode: "live", workspaceId, view: emptyView(), connection: "connecting", error: null, record: null, clientStart: Date.now() };
    emit();
    let res: Response;
    try {
      res = await fetch("/api/runs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ workspaceId, requirementSetId }),
      });
    } catch {
      return update(t, (s) => ({ ...s, connection: "lost", error: "Could not reach the app server. Check your connection and try again." }));
    }
    if (!res.ok || !res.body) {
      const j = await res.json().catch(() => ({}));
      return update(t, (s) => ({ ...s, connection: "closed", error: j.error ?? `The run could not start (HTTP ${res.status}).` }));
    }
    update(t, (s) => ({ ...s, connection: "streaming" }));
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const { events, errors, rest } = parseSse(buf);
        buf = rest;
        if (events.length) update(t, (s) => ({ ...s, view: applyEvents(s.view, events) }));
        if (errors.length) update(t, (s) => ({ ...s, error: errors[0].error }));
      }
    } catch {
      /* stream interrupted: fall through to reconnect */
    }
    const s = session as RunSession | null;
    if (t !== token || !s) return;
    if (ended(s.view) || !s.view.runId) return finish(t, workspaceId, s.view.runId);

    // The stream dropped before the run ended: read the server's saved progress instead (deduplicated by seq).
    update(t, (x) => ({ ...x, connection: "reconnecting" }));
    const runId = s.view.runId;
    for (let i = 0; i < 120; i++) {
      await sleep(2000);
      if (t !== token) return;
      const rec = await getRun(workspaceId, runId).catch(() => null);
      if (rec) update(t, (x) => ({ ...x, view: applyEvents(x.view, rec.events) }));
      if (session && ended(session.view)) return finish(t, workspaceId, runId);
    }
    update(t, (x) => ({
      ...x,
      connection: "lost",
      error: "Lost contact with this run. Its outcome is unknown; check the saved runs list or analyse again.",
    }));
  },

  /** Play back a saved run's own events at their recorded time offsets (never re-runs anything). */
  async replay(workspaceId: string, runId: string, speed = 1) {
    const t = ++token;
    const record = await getRun(workspaceId, runId).catch(() => null);
    if (t !== token) return;
    if (!record) {
      session = { mode: "replay", workspaceId, view: emptyView(), connection: "closed", error: "This saved run is no longer available on the server.", record: null, clientStart: Date.now() };
      return emit();
    }
    session = { mode: "replay", workspaceId, view: emptyView(), connection: "streaming", error: null, record, clientStart: Date.now() };
    emit();
    const t0 = Date.parse(record.events[0]?.at ?? record.startedAt);
    let shown = 0;
    for (const e of record.events) {
      const wait = Math.min((Date.parse(e.at) - t0) / speed - shown, 15_000);
      if (wait > 0) {
        await sleep(wait);
        shown += wait;
      }
      update(t, (s) => ({ ...s, view: applyEvents(s.view, [e]) }));
    }
    update(t, (s) => ({ ...s, connection: "closed" }));
  },

  /** Show a saved run as it ended (no playback). */
  async show(workspaceId: string, runId: string) {
    const t = ++token;
    const record = await getRun(workspaceId, runId).catch(() => null);
    if (t !== token) return;
    session = record
      ? { mode: "replay", workspaceId, view: applyEvents(emptyView(), record.events), connection: "closed", error: null, record, clientStart: Date.now() }
      : { mode: "replay", workspaceId, view: emptyView(), connection: "closed", error: "This saved run is no longer available on the server.", record: null, clientStart: Date.now() };
    emit();
  },
};

export function useRunList(workspaceId: string) {
  const e = useShared(`runs:${workspaceId}`, async () => {
    const res = await fetch(`/api/runs?workspaceId=${encodeURIComponent(workspaceId)}`);
    const j = await res.json();
    if (!res.ok) throw new Error(j.error ?? "Could not load saved runs.");
    return j.runs as RunSummary[];
  });
  return { runs: e.data ?? [], loading: e.loading, error: e.error ?? null };
}

export function useSavedRun(workspaceId: string, runId: string | null) {
  const e = useShared(`runs:${workspaceId}:${runId ?? "none"}`, async () => (runId ? getRun(workspaceId, runId) : null));
  return e.data ?? null;
}
