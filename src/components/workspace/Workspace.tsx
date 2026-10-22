"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { STEP_LABEL } from "@/lib/run";
import { useRunSession } from "@/lib/run-client";
import { useGapReport } from "@/lib/use-report";
import { useValidation } from "@/lib/use-validation";
import { DossierStep } from "./DossierStep";
import { FindingsStep } from "./FindingsStep";
import { ReadinessStep } from "./ReadinessStep";

export type StepId = "dossier" | "findings" | "readiness";
const STEPS: { id: StepId; n: string; label: string }[] = [
  { id: "dossier", n: "01", label: "Dossier" },
  { id: "findings", n: "02", label: "Findings" },
  { id: "readiness", n: "03", label: "CDSCO readiness" },
];
const isStep = (s: string): s is StepId => STEPS.some((x) => x.id === s);

/** The active step lives in the URL hash, so Back/Forward and reloads keep it. Run state is global and survives step changes. */
function useStep(): [StepId, (s: StepId) => void] {
  const subscribe = useCallback((cb: () => void) => {
    window.addEventListener("hashchange", cb);
    return () => window.removeEventListener("hashchange", cb);
  }, []);
  const hash = useSyncExternalStore(
    subscribe,
    () => window.location.hash.slice(1),
    () => "",
  );
  const step: StepId = isStep(hash) ? hash : "dossier";
  const go = useCallback((s: StepId) => {
    if (window.location.hash.slice(1) !== s) window.location.hash = s;
  }, []);
  return [step, go];
}

function StatusArea() {
  const { results, state } = useGapReport();
  const session = useRunSession();
  const live = session && session.workspaceId === state.workspaceId && session.mode === "live" ? session : null;
  const running = live && ["connecting", "streaming", "reconnecting"].includes(live.connection);
  const runningStep = running ? Object.entries(live.view.steps).find(([, s]) => s.status === "running")?.[0] : null;
  return (
    <div className="flex min-w-0 items-center gap-3 font-mono text-[10px] uppercase tracking-[0.16em]" role="status" aria-live="polite">
      {running ? (
        <span className="flex items-center gap-1.5 truncate text-ion">
          <span aria-hidden className="anim-pulse h-1.5 w-1.5 rounded-full bg-ion" />
          {runningStep ? STEP_LABEL[runningStep as keyof typeof STEP_LABEL] : "Starting run"}
        </span>
      ) : results.aiConfigured === null ? (
        <span className="text-porcelain/40">Checking AI…</span>
      ) : results.aiConfigured ? (
        <span className="hidden truncate text-porcelain/45 md:inline">AI ready · {results.model}</span>
      ) : (
        <span className="text-crimson">AI not configured</span>
      )}
    </div>
  );
}

/** Compact, application-first shell: brand, the three steps, status. One step on screen at a time. */
export function Workspace() {
  const [step, go] = useStep();
  const { state, report, uploads } = useGapReport();
  const { report: validation } = useValidation(state.workspaceId);
  const readable = uploads.uploads.filter((u) => u.status === "extracted").length;
  const done: Record<StepId, boolean> = {
    dossier: readable > 0,
    findings: Boolean(report.analysis),
    readiness: Boolean(validation && report.analysis),
  };

  // Move focus to the step's heading after a step change (keyboard and screen-reader users).
  useEffect(() => {
    document.getElementById(`step-${step}`)?.focus({ preventScroll: true });
  }, [step]);

  return (
    <div className="stage flex min-h-[100svh] flex-col">
      <header className="print-hide sticky top-0 z-40 border-b hairline bg-obsidian/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4 sm:gap-6">
          <a href="#dossier" className="flex shrink-0 items-center gap-2 font-semibold tracking-tight focus:outline-none focus-visible:ring-2 focus-visible:ring-ion">
            <span aria-hidden className="inline-block h-2.5 w-2.5 rotate-45 bg-gradient-to-br from-ion to-crimson" />
            <span className="hidden sm:inline">Evidentra</span>
          </a>
          <nav aria-label="Steps" className="flex min-w-0 flex-1 items-center justify-center gap-1">
            {STEPS.map((s, i) => {
              const active = step === s.id;
              return (
                <div key={s.id} className="flex items-center">
                  {i > 0 && <span aria-hidden className={`mx-0.5 hidden h-px w-6 sm:block ${done[STEPS[i - 1].id] ? "bg-ion/60" : "bg-porcelain/15"}`} />}
                  <button
                    type="button"
                    onClick={() => go(s.id)}
                    aria-current={active ? "step" : undefined}
                    className={`press flex items-center gap-2 rounded-full px-2.5 py-1.5 text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-ion sm:px-3 sm:text-sm ${
                      active ? "bg-porcelain/10 text-porcelain" : "text-porcelain/60 hover:text-porcelain"
                    }`}
                  >
                    <span
                      aria-hidden
                      className={`flex h-5 w-5 items-center justify-center rounded-full border font-mono text-[10px] ${
                        done[s.id] ? "border-ion bg-ion text-obsidian" : active ? "border-ion text-ion" : "border-porcelain/25"
                      }`}
                    >
                      {done[s.id] ? "✓" : s.n}
                    </span>
                    <span className={s.id === "readiness" ? "sr-only min-[420px]:not-sr-only" : ""}>{s.label}</span>
                    <span className="sr-only">{done[s.id] ? "(completed)" : ""}</span>
                  </button>
                </div>
              );
            })}
          </nav>
          {state.isDemo && (
            <span className="hidden shrink-0 rounded-full border border-lime/60 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.16em] text-lime lg:inline">
              Synthetic demo data
            </span>
          )}
          <StatusArea />
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-5">
        {step === "dossier" && <DossierStep onNext={() => go("findings")} />}
        {step === "findings" && <FindingsStep onBack={() => go("dossier")} onNext={() => go("readiness")} />}
        {step === "readiness" && <ReadinessStep onBack={() => go("findings")} />}
      </main>
    </div>
  );
}
