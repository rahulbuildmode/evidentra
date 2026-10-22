"use client";

import { useState } from "react";
import { AiAnalysisPanel } from "@/components/AiAnalysisPanel";
import { Badge, Button, Card, DemoNotice, PageHeader } from "@/components/ui";
import { runChecks, todayISO } from "@/lib/checks";
import { useAppState, useToday } from "@/lib/store";
import type { Finding, Severity } from "@/lib/types";

const TONE: Record<Severity, "bad" | "warn" | "neutral"> = { fail: "bad", warn: "warn", info: "neutral" };
const LABEL: Record<Severity, string> = { fail: "Needs attention", warn: "Check soon", info: "Note" };

export default function ConsistencyChecksPage() {
  const state = useAppState();
  const [ranAt, setRanAt] = useState<{ today: string; findings: Finding[] } | null>(null);

  // Checks are plain code. Showing live results; the button re-runs them with a fresh date.
  const clock = useToday();
  const live = runChecks(state, clock);
  const shown = ranAt ? ranAt.findings : live;
  const asOf = ranAt ? ranAt.today : clock;

  return (
    <>
      <PageHeader
        title="Consistency Checks"
        subtitle="AI-assisted analysis of your uploads, plus deterministic comparisons of identifiers, names and certificate dates."
        actions={
          <Button
            variant="primary"
            onClick={() => {
              const today = todayISO();
              setRanAt({ today, findings: runChecks(state, today) });
            }}
          >
            Re-run checks
          </Button>
        }
      />
      <AiAnalysisPanel />

      <h2 className="mb-3 text-base font-semibold text-ink">Deterministic checks on workspace facts</h2>
      {state.isDemo && <DemoNotice>These findings come from deliberately planted errors in fictional demo documents.</DemoNotice>}
      <p className="mb-4 text-xs text-mute">Dates checked as of {asOf ?? "…"} (this device&apos;s clock).</p>

      {state.facts.length === 0 ? (
        <Card>
          <p className="text-sm text-ink-soft">
            No workspace facts to compare. For uploaded PDFs, use the AI analysis above. An empty result here does not mean
            your documents are consistent.
          </p>
        </Card>
      ) : shown.length === 0 ? (
        <Card>
          <p className="text-sm text-ink-soft">No inconsistencies found among the extracted facts. A human review is still required.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {shown.map((f) => (
            <Card key={f.id}>
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={TONE[f.severity]}>{LABEL[f.severity]}</Badge>
                <span className="text-xs text-mute">{f.check}</span>
              </div>
              <h2 className="mt-2 text-sm font-semibold text-ink">{f.title}</h2>
              <p className="mt-1 text-sm text-ink-soft">{f.detail}</p>
              <ul className="mt-3 space-y-2">
                {f.citations.map((c, i) => (
                  <li key={i} className="border-l-2 border-teal pl-3 text-sm">
                    <span className="italic text-ink-soft">&ldquo;{c.quote}&rdquo;</span>
                    <div className="text-xs text-mute">
                      {c.filename}, page {c.page}
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
