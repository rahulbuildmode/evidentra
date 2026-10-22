"use client";

import { useState, type ReactNode } from "react";
import type { ReportCitation, ReportFinding } from "@/lib/report";
import { reviewActions } from "@/lib/review-store";
import { useGapReport } from "@/lib/use-report";
import { ChapterHead } from "./Chapter";
import { Reveal } from "./Reveal";

const RANK = { high: 0, medium: 1, low: 2 } as const;

/** Highlight the conflicting value inside the real quotation, if it appears there. */
function Highlighted({ quote, value }: { quote: string; value?: string }): ReactNode {
  if (!value) return <>“{quote}”</>;
  const i = quote.toLowerCase().indexOf(value.toLowerCase());
  if (i < 0) return <>“{quote}”</>;
  return (
    <>
      “{quote.slice(0, i)}
      <mark className="conflict">{quote.slice(i, i + value.length)}</mark>
      {quote.slice(i + value.length)}”
    </>
  );
}

/** Group a finding's passages into sides: by conflicting value (code checks) or by document (AI). */
function sides(f: ReportFinding): { label: string; cites: ReportCitation[] }[] {
  const key = (c: ReportCitation) => (c.value ? c.value : c.filename);
  const groups = new Map<string, ReportCitation[]>();
  for (const c of f.citations) groups.set(key(c), [...(groups.get(key(c)) ?? []), c]);
  return [...groups.entries()].map(([label, cites]) => ({ label, cites }));
}

function EvidencePanel({ side, tone, delay }: { side: { label: string; cites: ReportCitation[] }; tone: "ion" | "crimson"; delay: number }) {
  return (
    <div
      className={`panel anim-fade-up relative rounded-2xl p-5 ${tone === "ion" ? "shadow-[0_0_60px_-20px_rgba(57,231,255,0.5)]" : "shadow-[0_0_60px_-20px_rgba(255,49,90,0.55)]"}`}
      style={{ ["--d" as string]: `${delay}ms` }}
    >
      <div className={`font-mono text-2xl font-bold ${tone === "ion" ? "text-ion" : "text-crimson"}`}>{side.label}</div>
      <ul className="mt-3 space-y-3">
        {side.cites.map((c, i) => (
          <li key={i}>
            <blockquote className="break-words text-sm leading-relaxed text-porcelain/85">
              <Highlighted quote={c.quote} value={c.value} />
            </blockquote>
            <div className="mt-1 break-all font-mono text-[11px] uppercase tracking-[0.1em] text-porcelain/50">
              {c.filename} · page {c.page ?? "?"} {c.verified ? <span className="text-ion">· verified</span> : <span className="text-crimson">· not verified</span>}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Feature 2 — Anomaly Engine: real cross-document inconsistencies, side by side. */
export function Anomalies() {
  const { state, reviews, report } = useGapReport();
  const list = report.findings
    .filter((f) => f.group === "discrepancy" && !f.dismissed)
    .sort((a, b) => Number(a.humanReviewed) - Number(b.humanReviewed) || RANK[a.severity] - RANK[b.severity]);
  const [selKey, setSelKey] = useState<string | null>(null);
  const sel = list.find((f) => f.key === selKey) ?? list[0] ?? null;
  const isSeed = report.analysis?.source === "demo-seed";
  const parts = sel ? sides(sel) : [];
  const [a, b] = parts;
  const rest = parts.slice(2);

  return (
    <section id="anomalies" className="stage print-hide relative overflow-hidden px-5 py-28">
      <div aria-hidden className="glow-crimson pointer-events-none absolute left-1/2 top-1/3 h-[40rem] w-[40rem] -translate-x-1/2 opacity-70" />
      <div className="relative mx-auto max-w-6xl">
        <ChapterHead
          n="02"
          name="Anomaly Engine"
          title={
            <>
              Where your documents
              <br />
              <span className="text-crimson">disagree.</span>
            </>
          }
          lead="Values are compared across documents. Each conflict shows the exact passages, documents and pages — nothing is flagged without text to point to."
        />

        {!report.analysis ? (
          <Reveal className="panel rounded-2xl px-6 py-8 text-porcelain/60">Analyse the dossier first. Inconsistencies appear here once documents have been compared.</Reveal>
        ) : list.length === 0 ? (
          <Reveal className="panel rounded-2xl px-6 py-8 text-porcelain/70">
            No inconsistencies were found between the analysed documents. That does not prove they are consistent — a person should still review
            them.
          </Reveal>
        ) : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[17rem_1fr] [&>*]:min-w-0">
            {/* Finding list */}
            <Reveal as="div" className="space-y-2">
              {isSeed && (
                <div className="mb-3 rounded-lg border border-lime/50 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.2em] text-lime">
                  Synthetic demo data — illustrative values
                </div>
              )}
              <ul className="space-y-2" aria-label="Inconsistencies">
                {list.map((f, i) => (
                  <li key={f.key}>
                    <button
                      type="button"
                      onClick={() => setSelKey(f.key)}
                      aria-pressed={sel?.key === f.key}
                      className={`press w-full rounded-xl border px-4 py-3 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-crimson ${
                        sel?.key === f.key ? "border-crimson/60 bg-crimson/10" : "hairline hover:border-porcelain/30"
                      }`}
                    >
                      <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-porcelain/50">
                        <span>{String(i + 1).padStart(2, "0")}</span>
                        <span>{f.provenance === "code" ? "Automatic check" : isSeed ? "Demo data" : "AI suggestion"}</span>
                        {f.humanReviewed && <span className="text-ion">· reviewed</span>}
                      </div>
                      <div className="mt-1 text-sm font-semibold leading-snug">{f.title}</div>
                    </button>
                  </li>
                ))}
              </ul>
            </Reveal>

            {/* Stage */}
            {sel && (
              <div key={sel.key}>
                <div className="relative grid grid-cols-1 items-stretch gap-4 md:grid-cols-[1fr_4.5rem_1fr] [&>*]:min-w-0">
                  {a && <EvidencePanel side={a} tone="ion" delay={0} />}
                  <div className="relative hidden items-center justify-center md:flex" aria-hidden>
                    <svg viewBox="0 0 72 120" className="h-28 w-full">
                      <line x1="0" y1="60" x2="72" y2="60" stroke="#ff315a" strokeWidth="1.5" className="anim-draw" style={{ ["--len" as string]: 72, ["--d" as string]: "250ms" }} />
                      <line x1="0" y1="60" x2="72" y2="60" stroke="#ff315a" strokeWidth="3" opacity="0.35" className="dash-flow" />
                      <circle cx="36" cy="60" r="15" fill="#090b12" stroke="#ff315a" strokeWidth="1.5" className="anim-node" style={{ ["--d" as string]: "450ms" }} />
                      <text x="36" y="66" textAnchor="middle" fontSize="18" fontWeight="700" fill="#ff315a" className="anim-fade" style={{ ["--d" as string]: "550ms" }}>
                        ≠
                      </text>
                    </svg>
                  </div>
                  <div className="text-center text-2xl font-bold text-crimson md:hidden" aria-hidden>
                    ≠
                  </div>
                  {b ? (
                    <EvidencePanel side={b} tone="crimson" delay={180} />
                  ) : (
                    <div className="panel rounded-2xl p-5 text-sm text-porcelain/60">Only one side of this difference could be quoted.</div>
                  )}
                </div>

                {rest.length > 0 && (
                  <div className="mt-4 text-sm text-porcelain/70">
                    Also appears as:{" "}
                    {rest.map((s) => (
                      <span key={s.label} className="mr-3 font-mono text-crimson">
                        {s.label}
                      </span>
                    ))}
                  </div>
                )}

                <div className="anim-fade-up mt-6 grid gap-5 rounded-2xl border hairline p-5 md:grid-cols-3" style={{ ["--d" as string]: "300ms" }}>
                  <div>
                    <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-porcelain/45">What we found</div>
                    <p className="mt-1 text-sm">{sel.detail}</p>
                    <p className="mt-1 text-xs text-porcelain/45">
                      {sel.provenance === "code" ? "Confirmed in the document text by an automatic check." : isSeed ? "Synthetic demo data." : "AI suggestion — the descriptions may differ in meaning."}
                    </p>
                  </div>
                  <div>
                    <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-porcelain/45">Why it matters</div>
                    <p className="mt-1 text-sm text-porcelain/80">{sel.whyItMatters}</p>
                  </div>
                  <div>
                    <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-porcelain/45">Next step</div>
                    <p className="mt-1 text-sm text-porcelain/80">{sel.nextStep}</p>
                    <button
                      type="button"
                      aria-pressed={sel.humanReviewed}
                      onClick={() => reviewActions.update(state.workspaceId, sel.key, sel.basis, { reviewed: !reviews[sel.key]?.reviewed })}
                      className={`press mt-3 rounded-full px-4 py-2 text-xs font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-ion ${
                        sel.humanReviewed ? "bg-ion text-obsidian" : "border border-porcelain/30 text-porcelain hover:border-ion"
                      }`}
                    >
                      <span key={String(sel.humanReviewed)} className="anim-status inline-block">
                        {sel.humanReviewed ? "✓ Reviewed" : "Mark as reviewed"}
                      </span>
                    </button>
                    {sel.changedSinceReview && <p className="mt-2 text-xs text-lime">The evidence changed since your review.</p>}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
