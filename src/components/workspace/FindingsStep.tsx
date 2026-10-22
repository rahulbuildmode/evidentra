"use client";

import { useState, type ReactNode } from "react";
import { categoryLabel } from "@/lib/analysis";
import { inspector } from "@/lib/inspector-store";
import type { ReportCitation, ReportFinding } from "@/lib/report";
import { reviewActions } from "@/lib/review-store";
import { relatedRequirements } from "@/lib/links";
import { VALIDATION_LABEL, type RequirementResult } from "@/lib/regulatory/types";
import { useGapReport } from "@/lib/use-report";
import { useValidation } from "@/lib/use-validation";
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
    <li className="rounded-lg border border-porcelain/10 bg-navy/60 p-3">
      <blockquote className="break-words text-sm leading-relaxed text-porcelain/90">
        <Highlighted quote={c.quote} value={c.value} />
      </blockquote>
      <div className="mt-1 break-all font-mono text-[10px] uppercase tracking-[0.1em] text-porcelain/50">
        {c.filename} · p.{c.page ?? "?"} · {c.verified ? <span className="text-ion">verified in text</span> : <span className="text-coral">not found in text</span>}
      </div>
    </li>
  );
}

/** Group a finding's quotations into competing sides: by stated value (code checks) or by document. */
function sides(f: ReportFinding): { label: string; sub: string | null; cites: ReportCitation[] }[] {
  const byValue = f.citations.every((c) => c.value);
  const groups = new Map<string, ReportCitation[]>();
  for (const c of f.citations) {
    const k = byValue ? c.value! : c.filename;
    groups.set(k, [...(groups.get(k) ?? []), c]);
  }
  return [...groups.entries()].map(([label, cites]) => ({
    label,
    sub: byValue ? [...new Set(cites.map((c) => c.filename.replace(/\.pdf$/i, "")))].join(", ") : null,
    cites,
  }));
}

type SidePart = ReturnType<typeof sides>[number];

function Side({ p, tone }: { p: SidePart; tone: string }) {
  return (
    <div className="min-w-0 space-y-2">
      <div>
        <div className={`break-words font-mono text-lg font-semibold ${tone}`}>{p.label}</div>
        {p.sub && <div className="truncate text-[11px] text-porcelain/45">{p.sub}</div>}
      </div>
      <ul className="space-y-2">
        {p.cites.map((c, i) => (
          <Cite key={i} c={c} />
        ))}
      </ul>
    </div>
  );
}

function Competing({ f }: { f: ReportFinding }) {
  const parts = sides(f);
  if (parts.length < 2) return f.citations.length ? <ul className="space-y-2">{f.citations.map((c, i) => <Cite key={i} c={c} />)}</ul> : null;
  const [a, b, ...rest] = parts;
  return (
    <div>
      <div className="grid grid-cols-1 items-start gap-3 md:grid-cols-[1fr_auto_1fr]">
        <Side p={a} tone="text-ion" />
        <div aria-hidden className="flex items-center justify-center self-center md:pt-1">
          <span className="flex h-8 w-8 items-center justify-center rounded-full border border-coral/50 bg-coral/10 text-coral">≠</span>
        </div>
        <Side p={b} tone="text-coral" />
      </div>
      {rest.length > 0 && <p className="mt-2 text-xs text-porcelain/55">Also stated: {rest.map((r) => r.label).join(", ")}</p>}
    </div>
  );
}

function Origin({ f, isSeed }: { f: ReportFinding; isSeed: boolean }) {
  const [label, cls] =
    f.provenance === "code"
      ? ["Verified by code", "border-ion/50 text-ion"]
      : isSeed
        ? ["Synthetic demo data", "border-dashed border-porcelain/40 text-porcelain/75"]
        : ["AI proposal", "border-ultra/60 text-ultra"];
  return <span className={`rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] ${cls}`}>{label}</span>;
}

const STATUS_TONE: Record<string, string> = {
  conflict_detected: "border-coral/50 text-coral",
  potential_gap: "border-amber/50 text-amber",
  needs_human_review: "border-amber/40 text-amber",
  evidence_found: "border-ion/50 text-ion",
  validated_against_source: "border-ion/50 text-ion",
};

function FindingDetail({
  f,
  isSeed,
  workspaceId,
  reviewed,
  onPin,
  related,
  onOpenRequirement,
}: {
  f: ReportFinding;
  isSeed: boolean;
  workspaceId: string;
  reviewed: boolean;
  onPin: () => void;
  related: RequirementResult[];
  onOpenRequirement: (id: string) => void;
}) {
  // Severity is shown only where it is justified: an exact, quote-verified mismatch of an identifying value.
  const severe = f.provenance === "code" && f.severity === "high" && f.group === "discrepancy";
  return (
    <div key={f.key} className="anim-fade-up space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <Origin f={f} isSeed={isSeed} />
        {severe && <span className="rounded-full border border-coral/50 bg-coral/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-coral">Conflict · identifying value</span>}
        <span className={`rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] ${f.humanReviewed ? "border-ion/50 text-ion" : "border-amber/50 text-amber"}`}>
          {f.humanReviewed ? "Reviewed by you" : "Needs human review"}
        </span>
      </div>
      <div>
        <h3 className="text-lg font-semibold leading-snug">{f.title}</h3>
        <p className="mt-1 text-sm text-porcelain/75">{f.detail}</p>
        <p className="mt-1 text-xs text-porcelain/45">
          {f.provenance === "code"
            ? "Exact comparison of values whose quotations were found in the text."
            : f.group === "missing_info"
              ? "Not found in the uploaded text — not proof that it is missing."
              : isSeed
                ? "Hand-written demo finding; its quotations are checked by code."
                : "AI interpretation; its quotations are checked by code, its meaning is not."}
        </p>
      </div>
      <Competing f={f} />
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
      {related.length > 0 && (
        <section aria-label="Related CDSCO requirements" className="rounded-xl border border-ion/20 bg-ion/[0.04] p-3">
          <h4 className="font-mono text-[10px] uppercase tracking-[0.18em] text-ion/80">Affects CDSCO requirement{related.length === 1 ? "" : "s"}</h4>
          <ul className="mt-2 space-y-2">
            {related.map((r) => (
              <li key={r.requirementId}>
                <button
                  type="button"
                  onClick={() => onOpenRequirement(r.requirementId)}
                  className="lift w-full rounded-lg border border-porcelain/10 bg-navy/60 px-3 py-2 text-left hover:border-ion/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-ion"
                >
                  <span className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-medium">{r.title}</span>
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] ${STATUS_TONE[r.status] ?? "border-porcelain/20 text-porcelain/60"}`}>{VALIDATION_LABEL[r.status]}</span>
                  </span>
                  <span className="block font-mono text-[10px] text-porcelain/45">{r.reference}</span>
                  <span className="mt-1 block text-xs text-porcelain/75">Next: {r.nextAction}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
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
            Inspect source pages →
          </button>
        )}
      </div>
      {f.changedSinceReview && <p className="text-xs text-amber">The evidence changed since your review.</p>}
    </div>
  );
}

export function FindingsStep({ onBack, onNext, onOpenRequirement }: { onBack: () => void; onNext: () => void; onOpenRequirement: (id: string) => void }) {
  const { state, report, reviews } = useGapReport();
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
        <div className="surface rounded-2xl p-6 text-sm text-porcelain/60">
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
              <div className="surface rounded-2xl p-6 text-sm text-porcelain/65">No inconsistencies were found between the analysed documents. That does not prove they are consistent.</div>
            ) : (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-[19rem_1fr] [&>*]:min-w-0">
                <ul className="space-y-1.5 pr-1 lg:max-h-[62vh] lg:overflow-auto" aria-label="Potential inconsistencies">
                  {issues.map((f) => (
                    <li key={f.key}>
                      <button
                        type="button"
                        onClick={() => setSelKey(f.key)}
                        aria-pressed={sel?.key === f.key}
                        className={`press w-full rounded-xl border px-3 py-2.5 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-coral ${
                          sel?.key === f.key ? "border-coral/60 bg-coral/10" : "hairline hover:border-porcelain/30"
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
                <div className="surface rounded-2xl p-5">{sel && <FindingDetail
                      f={sel}
                      isSeed={isSeed}
                      workspaceId={ws}
                      reviewed={Boolean(reviews[sel.key]?.reviewed)}
                      onPin={() => setSelKey(sel.key)}
                      related={relatedRequirements(sel, validation)}
                      onOpenRequirement={onOpenRequirement}
                    />}</div>
              </div>
            ))}

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
