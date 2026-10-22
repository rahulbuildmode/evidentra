"use client";

import { useState, type ReactNode } from "react";
import { categoryLabel } from "@/lib/analysis";
import { inspector } from "@/lib/inspector-store";
import type { ReportCitation, ReportFinding } from "@/lib/report";
import { reviewActions } from "@/lib/review-store";
import { useGapReport } from "@/lib/use-report";
import { CHECK_LABEL } from "../EvidenceInspector";

const RANK = { high: 0, medium: 1, low: 2 } as const;
const fmt = (iso: string) => new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

/** Highlight the conflicting value inside the real quotation, only where it literally appears. */
function Highlighted({ quote, value }: { quote: string; value?: string }): ReactNode {
  const i = value ? quote.toLowerCase().indexOf(value.toLowerCase()) : -1;
  if (!value || i < 0) return <>“{quote}”</>;
  return (
    <>
      “{quote.slice(0, i)}
      <mark className="conflict">{quote.slice(i, i + value.length)}</mark>
      {quote.slice(i + value.length)}”
    </>
  );
}

function Cite({ c }: { c: ReportCitation }) {
  return (
    <li className="rounded-lg border hairline bg-obsidian/50 p-3">
      <blockquote className="break-words text-sm leading-relaxed text-porcelain/90">
        <Highlighted quote={c.quote} value={c.value} />
      </blockquote>
      <div className="mt-1 break-all font-mono text-[10px] uppercase tracking-[0.1em] text-porcelain/50">
        {c.filename} · p.{c.page ?? "?"} · {c.verified ? <span className="text-ion">quote verified in text</span> : <span className="text-crimson">quote not found in text</span>}
      </div>
    </li>
  );
}

function Origin({ f, isSeed }: { f: ReportFinding; isSeed: boolean }) {
  const [label, cls] =
    f.provenance === "code" ? ["Code check", "border-ion/50 text-ion"] : isSeed ? ["Synthetic demo data", "border-lime/60 text-lime"] : ["AI proposal", "border-ultra/60 text-ultra"];
  return <span className={`rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] ${cls}`}>{label}</span>;
}

function FindingDetail({ f, isSeed, workspaceId, reviewed, onPin }: { f: ReportFinding; isSeed: boolean; workspaceId: string; reviewed: boolean; onPin: () => void }) {
  return (
    <div key={f.key} className="anim-fade-up space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Origin f={f} isSeed={isSeed} />
        <span className={`rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] ${f.humanReviewed ? "border-ion/50 text-ion" : "border-crimson/50 text-crimson"}`}>
          {f.humanReviewed ? "Reviewed by you" : "Human review required"}
        </span>
      </div>
      <div>
        <h3 className="text-lg font-semibold leading-snug">{f.title}</h3>
        <p className="mt-1 text-sm text-porcelain/75">{f.detail}</p>
        <p className="mt-1 text-xs text-porcelain/45">
          {f.provenance === "code"
            ? "Exact comparison of quote-verified values."
            : f.group === "missing_info"
              ? "Not found in the uploaded text — not proof that it is missing."
              : isSeed
                ? "Hand-written demo finding; its quotations are checked by code."
                : "AI interpretation; its quotations are checked by code, its meaning is not."}
        </p>
      </div>
      {f.citations.length > 0 && <ul className="space-y-2">{f.citations.map((c, i) => <Cite key={i} c={c} />)}</ul>}
      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-porcelain/45">Why it matters</dt>
          <dd className="mt-0.5 text-porcelain/80">{f.whyItMatters}</dd>
        </div>
        <div>
          <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-porcelain/45">Next step</dt>
          <dd className="mt-0.5 text-porcelain/80">{f.nextStep}</dd>
        </div>
      </dl>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          aria-pressed={reviewed}
          onClick={() => {
            onPin(); // keep this item selected when the list re-sorts
            reviewActions.update(workspaceId, f.key, f.basis, { reviewed: !reviewed });
          }}
          className={`press rounded-full px-4 py-1.5 text-xs font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-ion ${reviewed ? "bg-ion text-obsidian" : "border border-porcelain/30 hover:border-ion"}`}
        >
          {reviewed ? "✓ Reviewed" : "Mark as reviewed"}
        </button>
        {f.citations.length > 0 && (
        <button
          type="button"
          onClick={() => inspector.open({ kind: "finding", finding: f, workspaceId })}
          className="press rounded-full border border-ion/50 px-4 py-1.5 text-xs text-ion hover:bg-ion/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-ion"
        >
          Inspect source text →
        </button>
        )}
      </div>
      {f.changedSinceReview && <p className="text-xs text-lime">The evidence changed since your review.</p>}
    </div>
  );
}

export function FindingsStep({ onBack, onNext }: { onBack: () => void; onNext: () => void }) {
  const { state, report, reviews } = useGapReport();
  const ws = state.workspaceId;
  const a = report.analysis;
  const isSeed = a?.source === "demo-seed";
  const issues = report.findings
    .filter((f) => !f.dismissed)
    .sort((x, y) => Number(x.group === "missing_info") - Number(y.group === "missing_info") || Number(x.humanReviewed) - Number(y.humanReviewed) || RANK[x.severity] - RANK[y.severity]);
  const facts = (a?.items ?? []).filter((i) => i.kind === "fact");
  const [tab, setTab] = useState<"issues" | "evidence">("issues");
  const [selKey, setSelKey] = useState<string | null>(null);
  const sel = issues.find((f) => f.key === selKey) ?? issues[0] ?? null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 id="step-findings" tabIndex={-1} className="text-xl font-semibold tracking-tight focus:outline-none">
            Findings
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
            ← Dossier
          </button>
          <button type="button" onClick={onNext} className="press rounded-full bg-ion px-4 py-1.5 text-xs font-semibold text-obsidian">
            CDSCO readiness →
          </button>
        </div>
      </div>

      {!a ? (
        <div className="panel rounded-2xl p-6 text-sm text-porcelain/60">
          Upload documents and run <strong>Analyse dossier</strong>, or load the synthetic demo.{" "}
          <button type="button" onClick={onBack} className="text-ion underline underline-offset-4">
            Go to Dossier
          </button>
        </div>
      ) : (
        <>
          <div role="tablist" aria-label="Result groups" className="inline-flex rounded-full border hairline p-0.5 text-sm">
            {(
              [
                ["issues", `Potential inconsistencies`, issues.length],
                ["evidence", "Evidence", facts.length],
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

          {tab === "issues" &&
            (issues.length === 0 ? (
              <div className="panel rounded-2xl p-6 text-sm text-porcelain/65">No inconsistencies were found between the analysed documents. That does not prove they are consistent.</div>
            ) : (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-[19rem_1fr] [&>*]:min-w-0">
                <ul className="space-y-1.5 pr-1 lg:max-h-[62vh] lg:overflow-auto" aria-label="Potential inconsistencies">
                  {issues.map((f) => (
                    <li key={f.key}>
                      <button
                        type="button"
                        onClick={() => setSelKey(f.key)}
                        aria-pressed={sel?.key === f.key}
                        className={`press w-full rounded-xl border px-3 py-2.5 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-crimson ${
                          sel?.key === f.key ? "border-crimson/60 bg-crimson/10" : "hairline hover:border-porcelain/30"
                        }`}
                      >
                        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-porcelain/45">
                          <span>{f.group === "missing_info" ? "Possible gap" : f.provenance === "code" ? "Code check" : isSeed ? "Demo seed" : "AI proposal"}</span>
                          {f.humanReviewed && <span className="text-ion">· reviewed</span>}
                        </div>
                        <div className="mt-0.5 text-sm font-medium leading-snug">{f.title}</div>
                      </button>
                    </li>
                  ))}
                </ul>
                <div className="panel rounded-2xl p-5">{sel && <FindingDetail f={sel} isSeed={isSeed} workspaceId={ws} reviewed={Boolean(reviews[sel.key]?.reviewed)} onPin={() => setSelKey(sel.key)} />}</div>
              </div>
            ))}

          {tab === "evidence" &&
            (facts.length === 0 ? (
              <div className="panel rounded-2xl p-6 text-sm text-porcelain/60">No evidence passages were identified in the analysed text.</div>
            ) : (
              <div className="panel overflow-x-auto rounded-2xl lg:max-h-[66vh] lg:overflow-y-auto">
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
                                <div className={CHECK_LABEL[c.check].cls.replace("text-teal-dark", "text-ion").replace("text-warn", "text-lime").replace("text-bad", "text-crimson")}>
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
