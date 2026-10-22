"use client";

import { useEffect, useState } from "react";
import type { RequirementSet } from "@/lib/requirements";
import { refreshShared } from "@/lib/shared-fetch";
import { useGapReport } from "@/lib/use-report";
import { IntelligenceScan, type ScanStatus, type ScanStep } from "./IntelligenceScan";

type AiStep = "analysis" | "mapping";

async function postStep(step: AiStep, workspaceId: string, setId: string) {
  const res = await fetch(step === "analysis" ? "/api/analyze" : "/api/requirements/map", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ workspaceId, requirementSetId: setId }),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.error ?? `The request failed (HTTP ${res.status}).`);
}

/** Real preparation step: list the workspace's documents and count the readable ones. */
async function prepare(workspaceId: string): Promise<number> {
  const res = await fetch(`/api/documents?workspaceId=${encodeURIComponent(workspaceId)}`);
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.error ?? "Could not list the documents.");
  const readable = (j.documents as { status: string }[]).filter((d) => d.status === "extracted").length;
  if (readable === 0) throw new Error("No readable documents to analyze. Upload a text-based PDF first.");
  return readable;
}

const idle = (): Record<ScanStep, ScanStatus> => ({ prepare: "idle", analysis: "idle", checks: "idle", mapping: "idle" });

/**
 * The single AI action. Runs the real steps in order and shows them in the Intelligence Scan:
 * prepare (list documents) → analysis (AI request) → checks (code comparison of the new facts)
 * → mapping (AI request). Re-running asks for confirmation. Failures stop the run and are shown.
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
  steps?: AiStep[];
  label?: string;
}) {
  const scanSteps: ScanStep[] = ["prepare", ...(steps.includes("analysis") ? (["analysis", "checks"] as ScanStep[]) : []), ...(steps.includes("mapping") ? (["mapping"] as ScanStep[]) : [])];
  const [status, setStatus] = useState<Record<ScanStep, ScanStatus>>(idle);
  const [errors, setErrors] = useState<Partial<Record<ScanStep, string>>>({});
  const [confirming, setConfirming] = useState(false);
  const [started, setStarted] = useState(false);
  const { report } = useGapReport();
  const [previous, setPrevious] = useState<{ analysis: string | null; mapping: string | null } | null>(null);
  const [startMs, setStartMs] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [finished, setFinished] = useState(false);
  const running = Object.values(status).some((s) => s === "running");

  useEffect(() => {
    if (!startMs || finished) return;
    const t = setInterval(() => setElapsed(Math.round((Date.now() - startMs) / 1000)), 500);
    return () => clearInterval(t);
  }, [startMs, finished]);

  const set1 = (k: ScanStep, v: ScanStatus) => setStatus((s) => ({ ...s, [k]: v }));

  async function run(from: ScanStep = "prepare") {
    setConfirming(false);
    setFinished(false);
    setErrors({});
    setStarted(true);
    const t0 = Date.now();
    setStartMs(t0);
    setElapsed(0);
    // Results count as fresh only once they differ from what was saved before this run.
    setPrevious({ analysis: report.analysis?.createdAt ?? null, mapping: report.mapping?.createdAt ?? null });
    const todo = scanSteps.slice(scanSteps.indexOf(from));
    setStatus((s) => ({ ...s, ...Object.fromEntries(todo.map((k) => [k, "idle" as ScanStatus])) }));
    let anyDone = false;
    for (const step of todo) {
      set1(step, "running");
      try {
        if (step === "prepare") await prepare(workspaceId);
        else if (step === "checks") {
          // Load the new facts; the exact comparisons then run in code on them.
          await refreshShared(`results:${workspaceId}`);
        } else {
          await postStep(step, workspaceId, set.id);
          anyDone = true;
        }
        set1(step, "done");
      } catch (e) {
        const msg = e instanceof TypeError ? "Could not reach the app server. Check your connection and try again." : (e as Error).message;
        set1(step, "failed");
        setErrors((x) => ({ ...x, [step]: msg }));
        break;
      }
    }
    setFinished(true);
    if (anyDone) {
      await refreshShared(`results:${workspaceId}`);
      onDone();
    }
  }

  const failedStep = scanSteps.find((k) => status[k] === "failed");
  const blocked = !aiConfigured
    ? "AI is not available: no Gemini API key is configured on the server."
    : readableDocs === 0
      ? "Upload at least one readable PDF first."
      : null;
  const primaryLabel = label ?? (hasResults ? "Analyse again" : "Analyse dossier");
  const aiRequests = steps.length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        <button
          type="button"
          disabled={Boolean(blocked) || running}
          onClick={() => (hasResults ? setConfirming(true) : run())}
          aria-describedby="analyze-help"
          className="press rounded-full bg-ion px-6 py-3 text-sm font-semibold tracking-wide text-obsidian shadow-[0_0_30px_rgba(57,231,255,0.35)] hover:bg-porcelain focus:outline-none focus-visible:ring-2 focus-visible:ring-porcelain disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
        >
          {running ? `Analysing… ${elapsed}s` : primaryLabel}
        </button>
        <span id="analyze-help" className="text-xs text-porcelain/55">
          {blocked ?? `${readableDocs} readable document${readableDocs === 1 ? "" : "s"} · ${aiRequests} Gemini request${aiRequests === 1 ? "" : "s"} (uses API quota)`}
        </span>
      </div>

      {confirming && (
        <div className="panel rounded-xl px-4 py-3 text-sm text-porcelain/85">
          This replaces the current analysis with a new AI run and uses API quota. Findings you marked as reviewed are kept.
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={() => run()} className="press rounded-full bg-ion px-4 py-1.5 text-xs font-semibold text-obsidian">
              Run again
            </button>
            <button type="button" onClick={() => setConfirming(false)} className="press rounded-full border hairline px-4 py-1.5 text-xs text-porcelain">
              Cancel
            </button>
          </div>
        </div>
      )}

      {started && (
        <IntelligenceScan
          steps={scanSteps}
          status={status}
          errors={errors}
          previous={previous}
          elapsed={elapsed}
          finished={finished}
          onRetry={() => failedStep && run(failedStep)}
        />
      )}
    </div>
  );
}
