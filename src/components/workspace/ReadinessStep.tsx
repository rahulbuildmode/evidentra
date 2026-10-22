"use client";

import { useEffect, useRef, useState } from "react";
import { validationCsv } from "@/lib/csv";
import { downloadCsv } from "@/lib/download";
import { inspector } from "@/lib/inspector-store";
import { VALIDATION_LABEL, VALIDATION_MEANING, VALIDATION_STATUS, type RequirementResult, type ValidationStatus } from "@/lib/regulatory/types";
import { fingerprint, type Review } from "@/lib/review";
import { reviewActions, useReviews } from "@/lib/review-store";
import { useGapReport } from "@/lib/use-report";
import { useValidation } from "@/lib/use-validation";
import { CHECK_LABEL } from "../EvidenceInspector";

const TONE: Record<ValidationStatus, string> = {
  conflict_detected: "border-coral/60 text-coral",
  potential_gap: "border-amber/60 text-amber",
  needs_human_review: "border-amber/30 text-amber/85",
  evidence_found: "border-ion/60 text-ion",
  validated_against_source: "border-ion/60 text-ion",
  not_applicable: "border-porcelain/25 text-porcelain/50",
};
/** AI-proposed quotations and code comparisons first; plain keyword locations last. */
const EVIDENCE_ORDER = { ai_quote: 0, deterministic: 1, keyword: 2 } as const;
const fmt = (iso: string) => new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
const checkTone = (c: keyof typeof CHECK_LABEL) => (c === "verified" ? "text-ion" : c === "verified_other_page" ? "text-amber" : "text-coral");

/** What a reviewer saw: if the status or evidence changes, the review is flagged as out of date. */
const reqBasis = (r: RequirementResult) => fingerprint([r.status, ...r.evidence.map((e) => `${e.filename}:${e.page}:${e.text}`)]);

function Requirement({
  r,
  open,
  onToggle,
  workspaceId,
  synthetic,
  review,
}: {
  r: RequirementResult;
  open: boolean;
  onToggle: () => void;
  workspaceId: string;
  synthetic: boolean;
  review: Review | undefined;
}) {
  const key = `req:${r.requirementId}`;
  const reviewed = Boolean(review?.reviewed);
  const stale = reviewed && review!.basis !== reqBasis(r);
  const id = `req-${r.requirementId.replace(/[^a-z0-9]/gi, "")}`;
  const ref = useRef<HTMLLIElement>(null);
  useEffect(() => {
    if (open) ref.current?.scrollIntoView({ block: "nearest", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }, [open]);
  return (
    <li ref={ref} className="border-t hairline first:border-t-0">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={onToggle}
        className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-porcelain/[0.03] focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ion"
      >
        <span aria-hidden className={`mt-0.5 text-porcelain/40 transition-transform ${open ? "rotate-90" : ""}`}>
          ›
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium">{r.title}</span>
          <span className="block truncate font-mono text-[10px] text-porcelain/45">
            {r.reference}
            {r.checklist && ` · MD-7 checklist ${r.checklist.item}`}
          </span>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-1">
          <span className={`rounded-full border px-2 py-0.5 text-[11px] ${TONE[r.status]}`}>{VALIDATION_LABEL[r.status]}</span>
          {reviewed && <span className={`text-[10px] ${stale ? "text-amber" : "text-ion"}`}>{stale ? "Reviewed · evidence changed" : "✓ Reviewed"}</span>}
        </span>
      </button>
      {open && (
        <div id={id} className="anim-fade-up space-y-3 px-4 pb-4 pl-10 text-sm">
          <div className="rounded-lg border border-ion/20 bg-ion/[0.04] p-3">
            <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-ion/80">Official source · {r.sourceVerified ? "excerpt verified" : "UNVERIFIED"}</div>
            <blockquote className="mt-1 italic text-porcelain/85">“{r.excerpt}”</blockquote>
            <a href={r.sourceUrl} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs text-ion underline-offset-2 hover:underline">
              {r.sourceTitle}, PDF p.{r.sourcePage} ↗
            </a>
            {r.checklist && (
              <a href={r.checklist.url} target="_blank" rel="noreferrer" className="ml-3 text-xs text-ion underline-offset-2 hover:underline">
                Checklist item {r.checklist.item} ↗
              </a>
            )}
          </div>
          <p>
            <span className="text-porcelain/45">Applicability (code): </span>
            <strong>{r.applicability.decision.replace("_", " ")}</strong> — <span className="text-porcelain/75">{r.applicability.rationale}</span>
          </p>
          <p>
            <span className="text-porcelain/45">Result: </span>
            <span className="text-porcelain/85">{r.explanation}</span>
            <span className="block text-xs text-porcelain/40">{VALIDATION_MEANING[r.status]}</span>
          </p>
          {r.ai && (
            <p className="text-xs">
              <span className="text-porcelain/45">{r.ai.source === "demo-seed" ? "Demo seed proposal" : "AI proposal"}: </span>
              <span className="text-ultra">{r.ai.proposedStatus ?? "none"}</span>
              {r.ai.rationale && <span className="text-porcelain/60"> — {r.ai.rationale}</span>}
            </p>
          )}
          {r.deterministic.length > 0 && (
            <ul className="space-y-0.5 text-xs">
              {r.deterministic.map((d, i) => (
                <li key={i}>
                  <span className={d.outcome === "failed" ? "text-coral" : d.outcome === "passed" ? "text-ion" : "text-porcelain/45"}>{d.outcome.replace("_", " ")}</span>{" "}
                  <span className="text-porcelain/70">· {d.check}</span>
                </li>
              ))}
            </ul>
          )}
          {r.evidence.length > 0 ? (
            <ul className="space-y-1.5">
              {[...r.evidence].sort((x, y) => EVIDENCE_ORDER[x.kind] - EVIDENCE_ORDER[y.kind]).slice(0, 6).map((e, i) => (
                <li key={i}>
                  <button
                    type="button"
                    onClick={() =>
                      inspector.open({
                        kind: "quote",
                        quote: {
                          origin: e.kind === "ai_quote" ? (r.ai?.source === "demo-seed" ? "Demo seed" : "AI proposal") : "Located by code",
                          context: `${r.title} — ${e.kind === "ai_quote" ? "AI-proposed passage" : e.kind === "keyword" ? "keyword located by code" : "value compared by code"}`,
                          quote: e.text,
                          proposedFilename: e.filename,
                          proposedPage: e.kind === "ai_quote" ? (e.proposedPage ?? null) : e.page,
                          check: e.kind === "ai_quote" ? (e.check ?? null) : "verified",
                          verifiedPage: e.page,
                          workspaceId,
                        },
                      })
                    }
                    className="w-full rounded-lg border hairline px-3 py-2 text-left hover:border-ion/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-ion"
                  >
                    <span className="block text-[10px] uppercase tracking-[0.12em] text-porcelain/40">
                      {e.kind === "ai_quote" ? "AI-proposed quote" : e.kind === "keyword" ? "Located by code" : "Compared by code"}
                      {e.synthetic && " · synthetic"}
                    </span>
                    <span className="block break-words italic text-porcelain/85">“{e.text}”</span>
                    <span className="block text-[11px] text-porcelain/50">
                      {e.filename} · p.{e.page ?? "?"}
                      {e.check && <span className={checkTone(e.check)}> · {CHECK_LABEL[e.check].text}</span>}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-porcelain/50">{r.searched}</p>
          )}
          <p>
            <span className="text-porcelain/45">Next: </span>
            {r.nextAction}
            {r.humanReviewRequired && <span className="ml-2 text-[11px] text-amber">Human review required</span>}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            {r.status !== "not_applicable" && (
              <button
                type="button"
                aria-pressed={reviewed}
                onClick={() => reviewActions.update(workspaceId, key, reqBasis(r), { reviewed: !reviewed })}
                className={`press rounded-full px-3 py-1 text-xs font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-ion ${reviewed ? "bg-ion text-obsidian" : "border border-porcelain/30 hover:border-ion"}`}
              >
                {reviewed ? "✓ Reviewed" : "Mark as reviewed"}
              </button>
            )}
            <button
              type="button"
              onClick={() => inspector.open({ kind: "requirement", result: r, workspaceId, synthetic })}
              className="text-xs text-ion underline-offset-4 hover:underline"
            >
              Open full evidence panel →
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

export function ReadinessStep({ onBack, focusReq = null }: { onBack: () => void; focusReq?: string | null }) {
  const { state, report } = useGapReport();
  const { report: v, error } = useValidation(state.workspaceId);
  const reviews = useReviews(state.workspaceId);
  const [filter, setFilter] = useState<ValidationStatus | "all">("all");
  const [openId, setOpenId] = useState<string | null>(focusReq);

  if (error) return <p role="alert" className="text-sm text-coral">The validation report could not be loaded: {error}</p>;
  if (!v)
    return (
      <p className="text-sm text-porcelain/60" role="status">
        Preparing the validation report on the server…
      </p>
    );
  const shown = v.results.filter((r) => filter === "all" || r.status === filter);
  const aiGaps = report.findings.filter((f) => f.group === "missing_info" && !f.dismissed);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 id="step-readiness" tabIndex={-1} className="text-xl font-semibold tracking-tight focus:outline-none">
            CDSCO readiness
          </h1>
          <p className="text-xs text-porcelain/50">
            {v.decision.status === "in_scope" ? v.decision.form : v.decision.label} · library v{v.pathway.libraryVersion} (checked {v.pathway.lastReviewed}) · prepared {fmt(v.generatedAt)}
            {v.synthetic && <span className="ml-2 text-porcelain/75">SYNTHETIC DEMO DATA</span>}
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={onBack} className="press rounded-full border hairline px-3 py-1.5 text-xs hover:border-porcelain/40">
            ← Findings
          </button>
          <button type="button" onClick={() => window.print()} className="press rounded-full border hairline px-3 py-1.5 text-xs hover:border-porcelain/40">
            Print / PDF
          </button>
          <button
            type="button"
            onClick={() => downloadCsv("evidentra-cdsco-validation.csv", validationCsv(v))}
            className="press rounded-full border border-ion/50 px-3 py-1.5 text-xs text-ion hover:bg-ion/10"
          >
            Download CSV
          </button>
        </div>
      </div>

      {/* Status filter = summary of the real results */}
      <div role="group" aria-label="Filter by result" className="flex flex-wrap gap-1.5">
        <button
          type="button"
          aria-pressed={filter === "all"}
          onClick={() => setFilter("all")}
          className={`press rounded-full border px-3 py-1 text-xs ${filter === "all" ? "border-porcelain/60 bg-porcelain/10" : "hairline text-porcelain/60"}`}
        >
          All {v.results.length}
        </button>
        {VALIDATION_STATUS.filter((s) => v.counts[s] > 0).map((s) => (
          <button
            key={s}
            type="button"
            aria-pressed={filter === s}
            title={VALIDATION_MEANING[s]}
            onClick={() => setFilter(filter === s ? "all" : s)}
            className={`press rounded-full border px-3 py-1 text-xs ${TONE[s]} ${filter === s ? "bg-porcelain/10" : "opacity-80 hover:opacity-100"}`}
          >
            {VALIDATION_LABEL[s]} <span className="font-mono">{v.counts[s]}</span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.6fr_1fr] [&>*]:min-w-0">
        <ul className="surface rounded-2xl lg:max-h-[64vh] lg:overflow-auto" aria-label="CDSCO requirement checks">
          {shown.map((r) => (
            <Requirement
              key={r.requirementId}
              r={r}
              open={openId === r.requirementId}
              onToggle={() => setOpenId(openId === r.requirementId ? null : r.requirementId)}
              workspaceId={v.workspaceId}
              synthetic={v.synthetic}
              review={reviews[`req:${r.requirementId}`]}
            />
          ))}
        </ul>

        <aside className="space-y-4">
          <section className="surface rounded-2xl p-4">
            <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-porcelain/60">Next actions</h2>
            {v.actions.length === 0 ? (
              <p className="mt-2 text-sm text-porcelain/55">No open actions from the checked items.</p>
            ) : (
              <ol className="mt-2 max-h-[24vh] space-y-2 overflow-auto pr-1 text-sm">
                {v.actions.map((a, i) => (
                  <li key={a.requirementId} className="flex gap-2">
                    <span className="font-mono text-xs text-porcelain/30">{String(i + 1).padStart(2, "0")}</span>
                    <button type="button" onClick={() => (setFilter("all"), setOpenId(a.requirementId))} className="text-left hover:text-ion">
                      {a.action}
                      <span className={`block text-[11px] ${TONE[a.status].split(" ")[1]}`}>
                        {a.title} · {VALIDATION_LABEL[a.status]}
                      </span>
                    </button>
                  </li>
                ))}
              </ol>
            )}
          </section>
          <section className="surface rounded-2xl p-4">
            <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-porcelain/60">Unresolved</h2>
            <ul className="mt-2 max-h-[22vh] space-y-1.5 overflow-auto pr-1 text-xs">
              {v.unresolved.map((u) => (
                <li key={u.item}>
                  <span className="text-porcelain/85">{u.item}</span>
                  <span className="block text-porcelain/45">{u.why}</span>
                </li>
              ))}
              {aiGaps.map((f) => (
                <li key={f.key}>
                  <span className="text-porcelain/85">Possible missing information: {f.title}</span>
                  <span className="block text-porcelain/45">{f.provenance === "demo-seed" ? "Demo seed" : "AI suggestion"} — not found in the uploaded text, not confirmed missing.</span>
                </li>
              ))}
            </ul>
          </section>
          <details className="rounded-2xl border hairline px-4 py-3 text-xs">
            <summary className="cursor-pointer text-porcelain/60">Scope and limitations</summary>
            <ul className="mt-2 list-disc space-y-1 pl-4 text-porcelain/55">
              {[...v.limitations, ...v.pathway.notCovered].map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
          </details>
        </aside>
      </div>
      <p className="text-[11px] text-porcelain/40">Prototype readiness assessment — not an official CDSCO decision, legal opinion or compliance certification.</p>
    </div>
  );
}
