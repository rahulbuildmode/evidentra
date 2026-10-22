import { randomBytes } from "node:crypto";
import { STEP_KEYS, type RunEvent, type RunEventType, type RunRecord, type RunSummary, type StepKey } from "../run";
import { isSafeId } from "../uploads";
import { readJson, storage, writeJson } from "./storage";

/**
 * Records one pipeline run on the server: wall-clock timestamps for chronology, a monotonic clock
 * (performance.now) for durations, and a numbered event list. Saved under runs/<workspace>/ next to
 * the uploads, so it has the same (non-durable on Vercel) storage as everything else.
 */

export const newRunId = () => `run-${Date.now().toString(36)}-${randomBytes(3).toString("hex")}`;

function runKey(workspaceId: string, runId: string): string {
  if (!isSafeId(workspaceId)) throw new Error("Invalid workspace id");
  if (!isSafeId(runId)) throw new Error("Invalid run id");
  return `runs/${workspaceId}/${runId}.json`;
}

export async function saveRun(run: RunRecord): Promise<void> {
  await writeJson(runKey(run.workspaceId, run.runId), run);
}

/** A run is only ever read from its own workspace's folder, so a run id from another workspace finds nothing. */
export async function getRun(workspaceId: string, runId: string): Promise<RunRecord | null> {
  if (!isSafeId(workspaceId) || !isSafeId(runId)) return null;
  const run = await readJson<RunRecord>(runKey(workspaceId, runId));
  return run && run.workspaceId === workspaceId ? run : null;
}

export async function listRuns(workspaceId: string, limit = 20): Promise<RunSummary[]> {
  if (!isSafeId(workspaceId)) return [];
  const prefix = `runs/${workspaceId}/`;
  const ids = (await storage().list(prefix)).filter((k) => k.endsWith(".json")).map((k) => k.slice(prefix.length, -5));
  // Run ids start with a base-36 timestamp, so sorting the ids newest-first avoids reading old runs.
  const newest = ids.filter((id) => isSafeId(id)).sort((a, b) => b.localeCompare(a)).slice(0, limit * 2);
  const runs = await Promise.all(newest.map((id) => getRun(workspaceId, id)));
  return runs
    .filter((r): r is RunRecord => r !== null)
    .map((r) => ({ runId: r.runId, kind: r.kind, status: r.status, startedAt: r.startedAt, endedAt: r.endedAt, durationMs: r.durationMs }))
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
    .slice(0, limit);
}

export class RunRecorder {
  readonly run: RunRecord;
  private t0 = performance.now();
  private stepT0 = new Map<StepKey, number>();
  private writes: Promise<void> = Promise.resolve();

  constructor(
    workspaceId: string,
    kind: RunRecord["kind"],
    requirementSetId: string | null,
    private emit: (e: RunEvent) => void = () => {},
  ) {
    this.run = {
      runId: newRunId(),
      workspaceId,
      kind,
      status: "running",
      startedAt: new Date().toISOString(),
      endedAt: null,
      durationMs: null,
      requirementSetId,
      steps: STEP_KEYS.map((key) => ({ key, status: "pending", startedAt: null, endedAt: null, durationMs: null, note: null })),
      events: [],
      documents: [],
      ai: [],
      quotes: [],
      checks: [],
      findings: null,
      failure: null,
    };
    this.event("run_started", undefined, kind === "demo-seed" ? "Loading the synthetic demo dossier" : "Run started");
  }

  get runId() {
    return this.run.runId;
  }

  /** Save the run as it stands (writes are chained so they never interleave). Lets a reconnecting client read progress. */
  persist(): Promise<void> {
    const snapshot = JSON.parse(JSON.stringify(this.run)) as RunRecord;
    this.writes = this.writes.then(() => saveRun(snapshot)).catch(() => {});
    return this.writes;
  }

  event(type: RunEventType, step?: StepKey, message?: string, data?: Record<string, unknown>): void {
    const e: RunEvent = { seq: this.run.events.length + 1, runId: this.run.runId, type, at: new Date().toISOString(), step, message, data };
    this.run.events.push(e);
    this.emit(e);
  }

  private step(key: StepKey) {
    return this.run.steps.find((s) => s.key === key)!;
  }

  start(key: StepKey, message?: string): void {
    const s = this.step(key);
    s.status = "running";
    s.startedAt = new Date().toISOString();
    this.stepT0.set(key, performance.now());
    this.event("step_started", key, message);
    void this.persist();
  }

  private finish(key: StepKey, status: "completed" | "failed", note: string | null, data?: Record<string, unknown>) {
    const s = this.step(key);
    s.status = status;
    s.endedAt = new Date().toISOString();
    s.durationMs = Math.round(performance.now() - (this.stepT0.get(key) ?? performance.now()));
    s.note = note;
    this.event(status === "completed" ? "step_completed" : "step_failed", key, note ?? undefined, { durationMs: s.durationMs, ...data });
    void this.persist();
  }

  complete(key: StepKey, note: string | null = null, data?: Record<string, unknown>): void {
    this.finish(key, "completed", note, data);
  }

  fail(key: StepKey, code: string, message: string): void {
    this.finish(key, "failed", message, { code });
    this.run.failure = { step: key, code, message };
  }

  /** A skipped step gets a reason, never a duration. */
  skip(key: StepKey, reason: string): void {
    const s = this.step(key);
    s.status = "skipped";
    s.note = reason;
    this.event("step_skipped", key, reason);
  }

  /** Mark every step that never started as skipped with the same reason. */
  skipRemaining(reason: string): void {
    for (const s of this.run.steps) if (s.status === "pending") this.skip(s.key, reason);
  }

  async end(): Promise<RunRecord> {
    this.run.status = this.run.failure ? "failed" : "completed";
    this.run.endedAt = new Date().toISOString();
    this.run.durationMs = Math.round(performance.now() - this.t0);
    this.event(
      this.run.failure ? "run_failed" : "run_completed",
      undefined,
      this.run.failure ? this.run.failure.message : "Run completed",
      { durationMs: this.run.durationMs },
    );
    await this.persist();
    return this.run;
  }
}
