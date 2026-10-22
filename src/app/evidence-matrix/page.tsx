"use client";

import { Badge, Button, Card, DemoNotice, PageHeader } from "@/components/ui";
import { evidenceMatrixCsv } from "@/lib/csv";
import { downloadCsv } from "@/lib/download";
import { REQUIREMENTS, REQUIREMENT_SET } from "@/lib/requirements";
import { actions, useAppState } from "@/lib/store";
import type { EvidenceStatus } from "@/lib/types";

const STATUS: Record<EvidenceStatus | "none", { label: string; tone: "teal" | "warn" | "bad" | "neutral" }> = {
  found: { label: "Evidence suggested", tone: "teal" },
  partial: { label: "Partial evidence", tone: "warn" },
  not_found: { label: "Not found in the uploaded documents", tone: "bad" },
  none: { label: "Not analysed", tone: "neutral" },
};

export default function EvidenceMatrixPage() {
  const state = useAppState();
  const hasAnalysis = state.evidence.length > 0;

  return (
    <>
      <PageHeader
        title="Evidence Matrix"
        subtitle="Each requirement topic against passages found in the documents. Suggestions are proposals only: you approve or reject each one."
        actions={
          <Button onClick={() => downloadCsv("evidentra-evidence-matrix.csv", evidenceMatrixCsv(state))}>
            Export CSV
          </Button>
        }
      />
      {state.isDemo && <DemoNotice>Evidence below is hand-seeded for the fictional demo. It is not AI output.</DemoNotice>}
      <div className="mb-4 rounded-md border border-warn/30 bg-warn-soft px-4 py-2 text-xs text-warn">
        Requirement set <strong>{REQUIREMENT_SET.name}</strong> v{REQUIREMENT_SET.version}: {REQUIREMENT_SET.status}
      </div>
      {!hasAnalysis && (
        <div className="mb-4 rounded-md border border-line bg-white px-4 py-3 text-sm text-ink-soft">
          No analysis has been run for this workspace, so every row shows &quot;Not analysed&quot;. This does not mean
          evidence is missing. AI-assisted matching is the next build step.
        </div>
      )}

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead>
              <tr className="border-b border-line text-xs uppercase tracking-wide text-mute">
                <th className="py-2 pr-4 font-medium">Requirement topic</th>
                <th className="py-2 pr-4 font-medium">Status</th>
                <th className="py-2 pr-4 font-medium">Cited passage</th>
                <th className="py-2 font-medium">Your review</th>
              </tr>
            </thead>
            <tbody>
              {REQUIREMENTS.map((r) => {
                const ev = state.evidence.find((e) => e.requirementId === r.id);
                const st = STATUS[ev?.suggestedStatus ?? "none"];
                const decision = state.decisions[r.id] ?? "undecided";
                return (
                  <tr key={r.id} className="border-b border-line/60 align-top last:border-0">
                    <td className="py-3 pr-4">
                      <div className="font-medium text-ink">
                        {r.id} · {r.title}
                      </div>
                      <div className="mt-1 text-xs text-mute">{r.description}</div>
                      <a href={r.sourceUrl} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs text-teal hover:underline">
                        {r.sourceName} ↗
                      </a>{" "}
                      <Badge tone="warn">Unverified</Badge>
                    </td>
                    <td className="py-3 pr-4">
                      <Badge tone={st.tone}>{st.label}</Badge>
                    </td>
                    <td className="py-3 pr-4 text-ink-soft">
                      {ev?.quote ? (
                        <>
                          <blockquote className="border-l-2 border-teal pl-2 italic">&ldquo;{ev.quote}&rdquo;</blockquote>
                          <div className="mt-1 text-xs text-mute">
                            {ev.filename}, page {ev.page}
                          </div>
                        </>
                      ) : (
                        <span className="text-xs text-mute">No passage cited.</span>
                      )}
                      {ev?.note && <div className="mt-1 text-xs text-mute">{ev.note}</div>}
                    </td>
                    <td className="py-3">
                      <div className="flex flex-col gap-1">
                        <div className="flex gap-1">
                          <Button
                            variant={decision === "approved" ? "primary" : "secondary"}
                            aria-pressed={decision === "approved"}
                            onClick={() => actions.setDecision(r.id, decision === "approved" ? "undecided" : "approved")}
                          >
                            Approve
                          </Button>
                          <Button
                            variant={decision === "rejected" ? "danger" : "secondary"}
                            aria-pressed={decision === "rejected"}
                            onClick={() => actions.setDecision(r.id, decision === "rejected" ? "undecided" : "rejected")}
                          >
                            Reject
                          </Button>
                        </div>
                        <span className="text-xs capitalize text-mute">{decision}</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
