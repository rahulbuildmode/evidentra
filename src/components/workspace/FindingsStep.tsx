"use client";

import { useState } from "react";
import { categoryLabel } from "@/lib/analysis";
import { inspector } from "@/lib/inspector-store";
import { useGapReport } from "@/lib/use-report";
import { useValidation } from "@/lib/use-validation";
import { CHECK_LABEL } from "../EvidenceInspector";
import { CaseBoard } from "./CaseBoard";

const RANK = { high: 0, medium: 1, low: 2 } as const;

const fmt = (iso: string) => new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

export function FindingsStep({ onBack, onNext, onOpenRequirement }: { onBack: () => void; onNext: () => void; onOpenRequirement: (id: string) => void }) {
  const { state, report, reviews, uploads } = useGapReport();
  const { report: validation } = useValidation(state.workspaceId);
  const ws = state.workspaceId;
  const a = report.analysis;
  const isSeed = a?.source === "demo-seed";
  const issues = report.findings
    .filter((f) => !f.dismissed)
    .sort((x, y) => Number(x.group === "missing_info") - Number(y.group === "missing_info") || Number(x.humanReviewed) - Number(y.humanReviewed) || RANK[x.severity] - RANK[y.severity]);
  const facts = (a?.items ?? []).filter((i) => i.kind === "fact");
  const [tab, setTab] = useState<"issues" | "evidence">("issues");
  const [selKey, setSelKey] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 id="step-findings" tabIndex={-1} className="text-xl font-semibold tracking-tight focus:outline-none">
            Investigation board
          </h1>
          <p className="text-xs text-porcelain/50">
            {!a
              ? "No analysis yet."
              : isSeed
                ? `SYNTHETIC DEMO DATA — hand-written seed, quotes verified by code · loaded ${fmt(a.createdAt)}`
                : `AI analysis run ${a.runId} (${a.model}) · saved ${fmt(a.createdAt)}`}
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={onBack} className="press rounded-full border hairline px-3 py-1.5 text-xs hover:border-porcelain/40">
            ← Case file
          </button>
          <button type="button" onClick={onNext} className="press rounded-full bg-ion px-4 py-1.5 text-xs font-semibold text-obsidian">
            Case summary →
          </button>
        </div>
      </div>

      {!a ? (
        <div className="surface rounded-2xl p-6 text-sm text-porcelain/60">
          No leads yet. Add evidence and run the scan, or open the synthetic demo case.{" "}
          <button type="button" onClick={onBack} className="text-ion underline underline-offset-4">
            Go to the case file
          </button>
        </div>
      ) : (
        <>
          <div role="tablist" aria-label="Result groups" className="inline-flex rounded-full border hairline p-0.5 text-sm">
            {(
              [
                ["issues", "Evidence board", issues.length],
                ["evidence", "Evidence locker", facts.length],
              ] as const
            ).map(([id, label, n]) => (
              <button
                key={id}
                role="tab"
                type="button"
                aria-selected={tab === id}
                onClick={() => setTab(id)}
                className={`press rounded-full px-4 py-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-ion ${tab === id ? "bg-porcelain/10 text-porcelain" : "text-porcelain/55 hover:text-porcelain"}`}
              >
                {label} <span className="ml-1 font-mono text-xs text-porcelain/45">{n}</span>
              </button>
            ))}
          </div>

          {tab === "issues" && (
            <CaseBoard
              workspaceId={ws}
              docs={uploads.uploads}
              leads={issues}
              isSeed={isSeed}
              validation={validation}
              reviews={reviews}
              selKey={selKey}
              onSelect={setSelKey}
              onOpenRequirement={onOpenRequirement}
            />
          )}

          {tab === "evidence" &&
            (facts.length === 0 ? (
              <div className="surface rounded-2xl p-6 text-sm text-porcelain/60">No evidence passages were identified in the analysed text.</div>
            ) : (
              <div className="surface overflow-x-auto rounded-2xl lg:max-h-[66vh] lg:overflow-y-auto">
                <table className="w-full text-left text-sm">
                  <thead className="sticky top-0 bg-obsidian-2 font-mono text-[10px] uppercase tracking-[0.14em] text-porcelain/45">
                    <tr>
                      <th className="px-4 py-2 font-normal">Field ({isSeed ? "demo label" : "AI proposal"})</th>
                      <th className="px-4 py-2 font-normal">Quoted text</th>
                      <th className="px-4 py-2 font-normal">Source</th>
                    </tr>
                  </thead>
                  <tbody>
                    {facts.map((f) => {
                      const c = f.citations[0];
                      return (
                        <tr key={f.id} className="border-t hairline align-top">
                          <td className="px-4 py-2">
                            <div className="text-[10px] uppercase tracking-[0.12em] text-ultra">{categoryLabel(f.category)}</div>
                            <div className="font-medium">{f.value}</div>
                          </td>
                          <td className="px-4 py-2">
                            {c && (
                              <button
                                type="button"
                                onClick={() =>
                                  inspector.open({
                                    kind: "quote",
                                    quote: {
                                      origin: isSeed ? "Demo seed" : "AI proposal",
                                      context: `${f.field}: ${f.value}`,
                                      quote: c.quote,
                                      proposedFilename: c.filename,
                                      proposedPage: c.claimedPage,
                                      check: c.check,
                                      verifiedPage: c.verifiedPage,
                                      workspaceId: ws,
                                    },
                                  })
                                }
                                className="text-left italic text-porcelain/80 hover:text-porcelain focus:outline-none focus-visible:ring-1 focus-visible:ring-ion"
                              >
                                “{c.quote}”
                              </button>
                            )}
                          </td>
                          <td className="whitespace-nowrap px-4 py-2 text-xs">
                            {c && (
                              <>
                                <div className="max-w-[14rem] truncate text-porcelain/60" title={c.filename}>
                                  {c.filename}
                                </div>
                                <div className={CHECK_LABEL[c.check].cls.replace("text-teal-dark", "text-ion").replace("text-warn", "text-amber").replace("text-bad", "text-coral")}>
                                  p.{c.verifiedPage ?? c.claimedPage ?? "?"} · {c.check === "verified" ? "verified" : c.check === "verified_other_page" ? `found on p.${c.verifiedPage} (AI said ${c.claimedPage})` : "not found"}
                                </div>
                              </>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ))}
        </>
      )}
    </div>
  );
}
