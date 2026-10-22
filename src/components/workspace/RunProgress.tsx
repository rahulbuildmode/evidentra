"use client";

import { useEffect, useState } from "react";
import { STEP_KEYS, STEP_LABEL, type StepKey } from "@/lib/run";
import { useRunList, useRunSession, useSavedRun } from "@/lib/run-client";
import { applyEvents, emptyView } from "@/lib/run-view";

const SHORT: Record<StepKey, string> = {
  documents: "Validate",
  extraction: "Extract",
  ai_analysis: "AI read",
  verification: "Verify quotes",
  checks: "Compare",
  ai_mapping: "AI match",
  validation: "CDSCO check",
  save: "Save",
};

const ICON = {
  pending: { i: "", c: "border-porcelain/20 text-porcelain/30" },
  running: { i: "•", c: "anim-pulse border-ion text-ion" },
  completed: { i: "✓", c: "border-ion bg-ion text-obsidian" },
  failed: { i: "!", c: "border-coral bg-coral/20 text-coral" },
  skipped: { i: "–", c: "border-porcelain/25 text-porcelain/40" },
} as const;

const fmtTime = (iso: string) => new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

/**
 * Compact pipeline strip. Live: server-sent events only. Otherwise the latest saved run, labelled as
 * saved with its original time. No percentages; elapsed time is a browser timer, labelled as such.
 */
export function RunProgress({ workspaceId, onNext }: { workspaceId: string; onNext: () => void }) {
  const session = useRunSession();
  const mine = session && session.workspaceId === workspaceId && session.mode === "live" ? session : null;
  const { runs } = useRunList(workspaceId);
  const saved = useSavedRun(workspaceId, mine ? null : (runs[0]?.runId ?? null));
  const view = mine ? mine.view : saved ? applyEvents(emptyView(), saved.events) : null;
  const streaming = Boolean(mine && ["connecting", "streaming", "reconnecting"].includes(mine.connection));
  const [now, setNow] = useState(0);
  useEffect(() => {
    if (!streaming) return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [streaming]);

  if (!view) return null;
  const kind = mine ? "live" : saved?.kind === "demo-seed" ? "demo" : "saved";
  const active = STEP_KEYS.find((k) => view.steps[k].status === "running") ?? null;
  const failed = STEP_KEYS.find((k) => view.steps[k].status === "failed") ?? null;
  const note = failed ? view.steps[failed].note : active ? view.steps[active].note : null;

  return (
    <section aria-label="Analysis progress" className="rounded-xl border hairline bg-obsidian/60 p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 font-mono text-[10px] uppercase tracking-[0.16em]">
        <span className={kind === "live" ? "text-ion" : "text-porcelain/50"}>
          {kind === "live"
            ? streaming
              ? `Live run · ${now ? Math.max(0, Math.round((now - mine!.clientStart) / 1000)) : 0} s (browser timer)`
              : `Live run · ${view.status}`
            : kind === "demo"
              ? `Demo seed load · ${view.startedAt ? fmtTime(view.startedAt) : ""}`
              : `Saved run — not live · ${view.startedAt ? fmtTime(view.startedAt) : ""} · ${view.status}`}
        </span>
        {view.durationMs !== null && <span className="text-porcelain/40">{(view.durationMs / 1000).toFixed(1)} s on server</span>}
      </div>
      <ol className="flex flex-wrap gap-x-1 gap-y-2" aria-live="polite">
        {STEP_KEYS.map((k) => {
          const s = view.steps[k];
          return (
            <li key={k} className="flex items-center gap-1.5 pr-2" title={`${STEP_LABEL[k]}: ${s.status}${s.note ? ` — ${s.note}` : ""}`}>
              <span aria-hidden className={`flex h-4 w-4 items-center justify-center rounded-full border text-[9px] font-bold ${ICON[s.status].c}`}>
                {ICON[s.status].i}
              </span>
              <span className={`text-xs ${s.status === "pending" || s.status === "skipped" ? "text-porcelain/40" : s.status === "failed" ? "text-coral" : "text-porcelain/85"}`}>
                {SHORT[k]}
              </span>
              <span className="sr-only">{s.status}</span>
            </li>
          );
        })}
      </ol>
      {note && <p className={`mt-2 text-xs ${failed ? "text-coral" : "text-porcelain/60"}`}>{note}</p>}
      {mine?.error && !failed && <p className="mt-2 text-xs text-coral">{mine.error}</p>}
      {mine?.connection === "reconnecting" && <p className="mt-2 text-xs text-amber">Stream dropped — reading the server&apos;s saved progress.</p>}
      {view.status === "completed" && kind === "live" && (
        <button type="button" onClick={onNext} className="press mt-3 rounded-full bg-ion px-4 py-1.5 text-xs font-semibold text-obsidian focus:outline-none focus-visible:ring-2 focus-visible:ring-porcelain">
          View findings →
        </button>
      )}
    </section>
  );
}
