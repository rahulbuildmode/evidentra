"use client";

import type { ReactNode } from "react";
import { inspector } from "@/lib/inspector-store";
import { VALIDATION_LABEL, type RequirementResult } from "@/lib/regulatory/types";
import type { ReportCitation, ReportFinding } from "@/lib/report";
import { reviewActions } from "@/lib/review-store";

/** Board lanes. A lead's lane comes from who produced it: an exact code check, the AI (or demo seed), or a possible gap. */
export const LANES: {
  id: string;
  title: (isSeed: boolean) => string;
  tone: string;
  activeCls: string;
  empty: string;
  match: (f: ReportFinding) => boolean;
}[] = [
  {
    id: "code",
    title: () => "Conflicts · verified by code",
    tone: "text-coral",
    activeCls: "border-coral/60 bg-coral/10",
    empty: "No exact value conflicts between quote-verified values.",
    match: (f) => f.group === "discrepancy" && f.provenance === "code",
  },
  {
    id: "ai",
    title: (isSeed) => (isSeed ? "Leads · demo seed" : "Leads · AI proposals"),
    tone: "text-ultra",
    activeCls: "border-ultra/60 bg-ultra/10",
    empty: "No inconsistencies proposed.",
    match: (f) => f.group === "discrepancy" && f.provenance !== "code",
  },
  {
    id: "gaps",
    title: () => "Possible gaps",
    tone: "text-amber",
    activeCls: "border-amber/60 bg-amber/10",
    empty: "No possible gaps proposed.",
    match: (f) => f.group === "missing_info",
  },
];

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

export function FindingDetail({
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

