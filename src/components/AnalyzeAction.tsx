"use client";

import { useEffect, useRef, useState } from "react";
import type { RequirementSet } from "@/lib/requirements";
import { runActions, useRunSession } from "@/lib/run-client";

/**
 * The single "Analyse dossier" action. Starts one server run (POST /api/runs) and follows its
 * server-sent events; the Engine Room shows the steps. Re-running asks for confirmation.
 */
export function AnalyzeAction({
  workspaceId,
  set,
  aiConfigured,
  readableDocs,
  hasResults,
  onDone,
}: {
  workspaceId: string;
  set: RequirementSet;
  aiConfigured: boolean | null;
  readableDocs: number;
  hasResults: boolean;
  onDone: () => void;
}) {
  const session = useRunSession();
  const [confirming, setConfirming] = useState(false);
  const mine = session?.mode === "live" && session.workspaceId === workspaceId ? session : null;
  const running = Boolean(mine && (mine.connection === "connecting" || mine.connection === "streaming" || mine.connection === "reconnecting"));
  const wasRunning = useRef(false);

  useEffect(() => {
    if (wasRunning.current && !running) onDone();
    wasRunning.current = running;
  }, [running, onDone]);

  function run() {
    setConfirming(false);
    void runActions.startLive(workspaceId, set.id);
    document.getElementById("engine-room")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const blocked =
    aiConfigured === null
      ? "Checking whether AI is configured on the server…"
      : !aiConfigured
        ? "AI is not available: GEMINI_API_KEY is not set for this deployment (see /api/health)."
        : readableDocs === 0
          ? "Upload at least one readable PDF first."
          : null;

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
          {running ? "Analysing… (see Engine Room)" : hasResults ? "Analyse again" : "Analyse dossier"}
        </button>
        <span id="analyze-help" className="text-xs text-porcelain/55">
          {blocked ?? `${readableDocs} readable document${readableDocs === 1 ? "" : "s"} · up to 2 Gemini requests plus retries (uses API quota)`}
        </span>
      </div>

      {confirming && (
        <div className="panel rounded-xl px-4 py-3 text-sm text-porcelain/85">
          This starts a new AI run and uses API quota. If it succeeds it replaces the current results; findings you marked as reviewed are kept.
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={run} className="press rounded-full bg-ion px-4 py-1.5 text-xs font-semibold text-obsidian">
              Run again
            </button>
            <button type="button" onClick={() => setConfirming(false)} className="press rounded-full border hairline px-4 py-1.5 text-xs text-porcelain">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
