"use client";

import { useEffect, useState } from "react";
import type { RequirementSet } from "@/lib/requirements";
import { Button, Notice } from "./ui";

type StepKey = "analysis" | "mapping";
type StepState = { status: "idle" | "running" | "done" | "failed"; error?: string };

const STEP_LABEL: Record<StepKey, string> = {
  analysis: "Read documents and check consistency",
  mapping: "Match evidence to requirements",
};

async function runStep(step: StepKey, workspaceId: string, setId: string) {
  const res = await fetch(step === "analysis" ? "/api/analyze" : "/api/requirements/map", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ workspaceId, requirementSetId: setId }),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.error ?? `The request failed (HTTP ${res.status}).`);
}

/**
 * One primary AI action. "Analyze documents" runs both AI steps in order (two Gemini requests):
 * reading facts/consistency, then matching evidence to the selected requirement set.
 * Re-running asks for confirmation; failures show which step failed and allow a retry of that step.
 */
export function AnalyzeAction({
  workspaceId,
  set,
  aiConfigured,
  readableDocs,
  hasResults,
  onDone,
  steps = ["analysis", "mapping"],
  label,
}: {
  workspaceId: string;
  set: RequirementSet;
  aiConfigured: boolean;
  readableDocs: number;
  hasResults: boolean;
  onDone: () => void;
  steps?: StepKey[];
  label?: string;
}) {
  const [state, setState] = useState<Record<StepKey, StepState>>({ analysis: { status: "idle" }, mapping: { status: "idle" } });
  const [confirming, setConfirming] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const running = Object.values(state).some((s) => s.status === "running");

  useEffect(() => {
    if (!startedAt) return;
    const t = setInterval(() => setElapsed(Math.round((Date.now() - startedAt) / 1000)), 500);
    return () => clearInterval(t);
  }, [startedAt]);

  async function run(only?: StepKey[]) {
    setConfirming(false);
    const todo = only ?? steps;
    setElapsed(0);
    setStartedAt(Date.now());
    setState((s) => ({ ...s, ...Object.fromEntries(todo.map((k) => [k, { status: "idle" }])) }));
    let anyDone = false;
    for (const step of todo) {
      setState((s) => ({ ...s, [step]: { status: "running" } }));
      try {
        await runStep(step, workspaceId, set.id);
        anyDone = true;
        setState((s) => ({ ...s, [step]: { status: "done" } }));
      } catch (e) {
        const msg = e instanceof TypeError ? "Could not reach the app server. Check your connection and try again." : (e as Error).message;
        setState((s) => ({ ...s, [step]: { status: "failed", error: msg } }));
        break; // stop: later steps would fail for the same reason
      }
    }
    setStartedAt(null);
    if (anyDone) onDone();
  }

  const blocked = !aiConfigured
    ? "AI is not available: no Gemini API key is configured on the server."
    : readableDocs === 0
      ? "Upload at least one readable PDF first."
      : null;
  const primaryLabel = label ?? (hasResults ? "Re-analyze documents" : "Analyze documents");
  const failed = steps.filter((k) => state[k].status === "failed");
  const shown = steps.filter((k) => state[k].status !== "idle");

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="primary"
          disabled={Boolean(blocked) || running}
          onClick={() => (hasResults ? setConfirming(true) : run())}
          aria-describedby="analyze-help"
        >
          {running ? `Analyzing… ${elapsed}s` : primaryLabel}
        </Button>
        <span id="analyze-help" className="text-xs text-ink-soft">
          {blocked ??
            `${readableDocs} readable document${readableDocs === 1 ? "" : "s"} · ${steps.length} Gemini request${steps.length === 1 ? "" : "s"} (uses API quota) · usually 10–60 s each`}
        </span>
      </div>

      {confirming && (
        <Notice tone="warn">
          This replaces the current {steps.length === 2 ? "analysis and evidence matches" : "results"} with a new AI run and uses API quota. Your
          reviews are kept.
          <div className="mt-2 flex gap-2">
            <Button size="sm" variant="primary" onClick={() => run()}>
              Run again
            </Button>
            <Button size="sm" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
          </div>
        </Notice>
      )}

      {shown.length > 0 && (
        <ul className="space-y-1 text-sm" aria-live="polite">
          {shown.map((k) => (
            <li key={k} className="flex items-center gap-2">
              <span aria-hidden className={state[k].status === "done" ? "text-teal" : state[k].status === "failed" ? "text-bad" : "text-mute"}>
                {state[k].status === "done" ? "✓" : state[k].status === "failed" ? "✕" : "…"}
              </span>
              <span className={state[k].status === "failed" ? "text-bad" : "text-ink-soft"}>
                {STEP_LABEL[k]}
                {state[k].status === "running" && " — in progress"}
                {state[k].status === "done" && " — done"}
              </span>
            </li>
          ))}
        </ul>
      )}

      {failed.map((k) => (
        <Notice key={k} tone="bad" role="alert">
          <strong>{STEP_LABEL[k]} failed.</strong> {state[k].error} Earlier results are unchanged.{" "}
          <button type="button" className="underline" onClick={() => run(steps.slice(steps.indexOf(k)))}>
            Retry
          </button>
        </Notice>
      ))}
    </div>
  );
}
