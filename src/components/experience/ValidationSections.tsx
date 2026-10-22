"use client";

import { inspector } from "@/lib/inspector-store";
import { VALIDATION_LABEL, VALIDATION_MEANING, type ValidationStatus } from "@/lib/regulatory/types";
import { useGapReport } from "@/lib/use-report";
import { useValidation } from "@/lib/use-validation";

const H = "mt-10 font-mono text-[11px] uppercase tracking-[0.25em] text-crimson";

const CHIP: Record<ValidationStatus, string> = {
  conflict_detected: "border-crimson/40 bg-crimson/10 text-crimson",
  potential_gap: "border-amber-600/40 bg-amber-100 text-amber-900",
  needs_human_review: "border-amber-600/40 bg-amber-50 text-amber-900",
  evidence_found: "border-teal/40 bg-teal-soft text-teal-dark",
  validated_against_source: "border-teal/50 bg-teal-soft text-teal-dark",
  not_applicable: "border-obsidian/15 bg-white text-obsidian/60",
};

const fmt = (iso: string) => new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

/** Sections A–E of the Readiness Brief, rendered only from the server's validation report. */
export function ValidationSections() {
  const { state, report: gap } = useGapReport();
  const { report: v, error } = useValidation(state.workspaceId);
  if (error) return <p className="mt-10 text-sm text-crimson">The validation report could not be loaded: {error}</p>;
  if (!v) return <p className="mt-10 text-sm text-obsidian/60">Preparing the validation report…</p>;
  const p = v.profile;
  const aiGaps = gap.findings.filter((f) => f.group === "missing_info" && !f.dismissed);

  return (
    <>
      <p className="mt-6 rounded-xl border border-obsidian/10 bg-porcelain px-4 py-3 text-xs text-obsidian/70">
        <strong>Prototype readiness assessment</strong> — not an official CDSCO decision, legal opinion or compliance certification. It does not say
        the dossier is compliant or will be approved.
        {v.synthetic && <strong className="ml-1 rounded bg-lime px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-obsidian">Synthetic demo data</strong>}
      </p>

      {/* A. Scope */}
      <h4 className={H}>A · Scope</h4>
      <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[11rem_1fr]">
        <dt className="text-obsidian/50">Device</dt>
        <dd>
          {p.deviceName || "Not stated"}
          {p.manufacturer && <span className="text-obsidian/55"> · {p.manufacturer}</span>}
        </dd>
        <dt className="text-obsidian/50">Pathway</dt>
        <dd>
          {v.decision.label}
          {v.decision.form && <span className="block text-obsidian/60">{v.decision.form}</span>}
        </dd>
        <dt className="text-obsidian/50">Risk class</dt>
        <dd>
          {p.riskClass === "unknown" ? "Not stated — applicability unresolved" : `Class ${p.riskClass} · ${p.riskClassConfirmed ? "confirmed by the user" : "entered, NOT confirmed"}`}
          {p.riskClassBasis && <span className="block text-xs text-obsidian/55">{p.riskClassBasis}</span>}
        </dd>
        <dt className="text-obsidian/50">Requirements library</dt>
        <dd>
          v{v.pathway.libraryVersion}, checked {v.pathway.lastReviewed} against{" "}
          <a href={v.pathway.source.url} target="_blank" rel="noreferrer" className="underline underline-offset-2">
            {v.pathway.source.title} ↗
          </a>{" "}
          <span className="text-xs text-obsidian/55">({v.pathway.source.version})</span>
        </dd>
        <dt className="text-obsidian/50">Inputs</dt>
        <dd className="text-xs text-obsidian/70">
          {v.inputs.documentsReviewed.length} document{v.inputs.documentsReviewed.length === 1 ? "" : "s"} searched
          {v.inputs.documentsSkipped.length > 0 && `, ${v.inputs.documentsSkipped.length} without text`} ·{" "}
          {v.inputs.analysis ? `analysis ${v.inputs.analysis.source === "demo-seed" ? "(demo seed)" : `run ${v.inputs.analysis.runId}`} of ${fmt(v.inputs.analysis.createdAt)}` : "no analysis yet"} ·{" "}
          {v.inputs.mapping
            ? `AI evidence matching of ${fmt(v.inputs.mapping.createdAt)}${v.inputs.mapping.stale ? " (older than the analysis)" : ""}`
            : "no AI evidence matching for these requirements yet"}{" "}
          · report prepared {fmt(v.generatedAt)}
        </dd>
        <dt className="text-obsidian/50">Limitations</dt>
        <dd>
          <ul className="list-disc space-y-0.5 pl-4 text-xs text-obsidian/70">
            {v.limitations.map((l) => (
              <li key={l}>{l}</li>
            ))}
            {v.pathway.notCovered.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        </dd>
      </dl>

      {/* B. Requirement-by-requirement */}
      <h4 className={H}>B · Requirement-by-requirement results</h4>
      <ul className="mt-3 divide-y divide-obsidian/10">
        {v.results.map((r) => {
          const best = r.evidence.find((e) => e.kind === "ai_quote" && e.page !== null) ?? r.evidence[0];
          return (
            <li key={r.requirementId} className="py-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-semibold">{r.title}</div>
                  <a href={r.sourceUrl} target="_blank" rel="noreferrer" className="font-mono text-[11px] text-obsidian/55 underline-offset-2 hover:underline">
                    {r.reference} · PDF p.{r.sourcePage} ↗
                  </a>
                  {r.checklist && <span className="ml-2 font-mono text-[11px] text-obsidian/45">· MD-7 checklist {r.checklist.item}</span>}
                </div>
                <span title={VALIDATION_MEANING[r.status]} className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${CHIP[r.status]}`}>
                  {VALIDATION_LABEL[r.status]}
                </span>
              </div>
              <p className="mt-1 text-xs text-obsidian/55">
                Applicability: <strong>{r.applicability.decision.replace("_", " ")}</strong> — {r.applicability.rationale}
              </p>
              <p className="mt-1 text-sm text-obsidian/80">{r.explanation}</p>
              {best && (
                <p className="mt-1 text-xs text-obsidian/60">
                  {best.kind === "ai_quote" ? "AI-proposed, code-checked" : best.kind === "keyword" ? "Located by code" : "Compared by code"}: “{best.text}” — {best.filename}, p.
                  {best.page ?? "?"}
                  {best.synthetic && " (synthetic demo document)"}
                </p>
              )}
              <p className="mt-1 text-sm">
                <span className="text-obsidian/50">Next: </span>
                {r.nextAction}
                {r.humanReviewRequired && <span className="ml-2 text-[11px] font-medium text-crimson">Human review required</span>}
              </p>
              <button
                type="button"
                onClick={() => inspector.open({ kind: "requirement", result: r, workspaceId: v.workspaceId, synthetic: v.synthetic })}
                className="print-hide mt-1 text-xs font-medium underline underline-offset-4 hover:text-crimson"
              >
                Inspect source, evidence and rationale
              </button>
            </li>
          );
        })}
      </ul>

      {/* C. Priority actions */}
      <h4 className={H}>C · Priority actions</h4>
      <p className="mt-1 text-xs text-obsidian/50">Ordered by result type: conflicts, then potential gaps, then items needing review. No severity scores are invented.</p>
      {v.actions.length === 0 ? (
        <p className="mt-3 text-sm text-obsidian/60">No open actions from the validated items. A qualified person should still review the full dossier.</p>
      ) : (
        <ol className="mt-3 space-y-3">
          {v.actions.map((a, i) => (
            <li key={a.requirementId} className="flex gap-4">
              <span className="font-mono text-sm font-bold text-obsidian/30">{String(i + 1).padStart(2, "0")}</span>
              <div className="text-sm">
                <div className="font-medium">{a.action}</div>
                <div className="text-obsidian/55">
                  {a.title} · {VALIDATION_LABEL[a.status]}
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}

      {/* D. Unresolved */}
      <h4 className={H}>D · Unresolved items</h4>
      <ul className="mt-3 space-y-2 text-sm">
        {v.unresolved.map((u) => (
          <li key={u.item}>
            <span className="font-medium">{u.item}</span>
            <div className="text-obsidian/60">{u.why}</div>
          </li>
        ))}
        {aiGaps.map((f) => (
          <li key={f.key}>
            <span className="font-medium">Possible missing information ({f.provenance === "demo-seed" ? "demo seed" : "AI suggestion"}): {f.title}</span>
            <div className="text-obsidian/60">Not found in the uploaded text — it may exist elsewhere. Not a requirement-level result.</div>
          </li>
        ))}
      </ul>

      {/* E. References */}
      <h4 className={H}>E · Regulatory references</h4>
      <ul className="mt-3 space-y-1 text-xs text-obsidian/70">
        {v.results.map((r) => (
          <li key={r.requirementId}>
            <span className="font-mono">{r.requirementId}</span> — {r.reference}:{" "}
            <a href={r.sourceUrl} target="_blank" rel="noreferrer" className="underline underline-offset-2">
              {r.sourceTitle}, PDF p.{r.sourcePage}
            </a>
            {r.checklist && (
              <>
                {" "}· also{" "}
                <a href={r.checklist.url} target="_blank" rel="noreferrer" className="underline underline-offset-2">
                  Form MD-7 checklist item {r.checklist.item}
                </a>
              </>
            )}{" "}
            {r.sourceVerified ? "(excerpt verified)" : "(UNVERIFIED — do not use for a definitive conclusion)"}
          </li>
        ))}
      </ul>
    </>
  );
}
