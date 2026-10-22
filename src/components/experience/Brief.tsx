"use client";

import { validationCsv } from "@/lib/csv";
import { downloadCsv } from "@/lib/download";
import type { ReportFinding } from "@/lib/report";
import { inspector } from "@/lib/inspector-store";
import { useGapReport } from "@/lib/use-report";
import { useValidation } from "@/lib/use-validation";
import { ChapterHead } from "./Chapter";
import { ValidationSections } from "./ValidationSections";
import { Reveal } from "./Reveal";

/** Labels that tell readers what kind of finding this is and whether a person has reviewed it. */
function findingKinds(f: ReportFinding, isSeed: boolean): { label: string; cls: string }[] {
  const kinds: { label: string; cls: string }[] = [];
  if (isSeed) kinds.push({ label: "Synthetic demo data", cls: "border-lime-700/40 text-lime-900 bg-lime/40" });
  else if (f.provenance === "code") kinds.push({ label: "Confirmed in document text", cls: "border-obsidian/20 text-obsidian bg-white" });
  else kinds.push({ label: "AI suggestion", cls: "border-ultra/30 text-ultra bg-ultra/5" });
  kinds.push(
    f.humanReviewed
      ? { label: "Reviewed by you", cls: "border-teal/30 text-teal-dark bg-teal-soft" }
      : { label: "Needs human review", cls: "border-crimson/30 text-crimson bg-crimson/5" },
  );
  return kinds;
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** Feature 3 — CDSCO Readiness Brief: one concise, readable report from the analysis. */
export function Brief() {
  const { state, report, loading } = useGapReport();
  const isSeed = report.analysis?.source === "demo-seed" || report.mapping?.source === "demo-seed";
  const device =
    report.analysis?.items.find((i) => i.kind === "fact" && i.category === "device_name" && i.citations[0]?.verifiedPage !== null)?.value ??
    (state.isDemo ? state.workspace.deviceName.value : "") ??
    "";
  const keyFindings = report.findings.filter((f) => f.group === "discrepancy" && !f.dismissed && f.effectiveStatus !== "resolved");
  const { report: v } = useValidation(state.workspaceId);
  const analysed = Boolean(report.analysis || report.mapping);

  const summary = !v
    ? "Preparing the validation report…"
    : `${plural(v.inputs.documentsReviewed.length, "readable document")} checked against ${v.results.length} selected CDSCO requirements: ${v.counts.conflict_detected} conflict${
        v.counts.conflict_detected === 1 ? "" : "s"
      }, ${plural(v.counts.potential_gap, "potential gap")}, ${v.counts.needs_human_review} needing human review, ${v.counts.evidence_found} with evidence found, ${
        v.counts.validated_against_source
      } validated against source, ${v.counts.not_applicable} not applicable.${analysed ? ` ${plural(keyFindings.length, "cross-document inconsistency", "cross-document inconsistencies")}.` : ""}`;

  return (
    <section id="report" className="relative bg-porcelain px-5 py-28 text-obsidian print:py-0">
      <div aria-hidden className="print-hide pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-obsidian to-porcelain" />
      <div className="relative mx-auto max-w-4xl">
        <ChapterHead
          n="03"
          name="CDSCO Readiness Brief"
          light
          title={
            <>
              One brief.
              <br />
              Everything that needs a decision.
            </>
          }
        />

        <Reveal as="article" className="rounded-3xl border border-obsidian/10 bg-white p-6 shadow-[0_30px_80px_-40px_rgba(9,11,18,0.35)] sm:p-10">
          <header className="flex flex-wrap items-start justify-between gap-4 border-b border-obsidian/10 pb-6">
            <div className="min-w-0">
              <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-obsidian/50">Readiness brief · {report.generatedFor || "…"}</div>
              <h3 className="mt-2 text-2xl font-bold tracking-tight">{device || "Untitled dossier"}</h3>
              {isSeed && <div className="mt-2 inline-block rounded-full bg-lime px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.18em]">Synthetic demo data</div>}
            </div>
            <div className="print-hide flex gap-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="press rounded-full bg-obsidian px-4 py-2 text-xs font-semibold text-porcelain hover:bg-crimson focus:outline-none focus-visible:ring-2 focus-visible:ring-crimson"
              >
                Print / save PDF
              </button>
              <button
                type="button"
                disabled={!v}
                onClick={() => v && downloadCsv("evidentra-cdsco-validation.csv", validationCsv(v))}
                className="press rounded-full border border-obsidian/20 px-4 py-2 text-xs font-semibold hover:border-obsidian disabled:opacity-40"
              >
                Download CSV
              </button>
            </div>
          </header>

          <p className="mt-6 text-xl leading-snug">{loading ? "Loading…" : summary}</p>
          <p className="mt-2 text-sm text-obsidian/60">
            This brief supports human review. It does not certify compliance, is not legal advice, and does not predict or guarantee CDSCO approval.
          </p>
          {report.analysis && (
            <p className="mt-2 font-mono text-[11px] text-obsidian/50">
              Built from {isSeed ? "the demo seed" : `analysis run ${report.analysis.runId}`} saved {new Date(report.analysis.createdAt).toLocaleString()}
              {report.mapping && report.mapping.createdAt !== report.analysis.createdAt && ` · requirement matches saved ${new Date(report.mapping.createdAt).toLocaleString()}`}
            </p>
          )}

          {analysed && (
            <>
              <h4 className="mt-10 font-mono text-[11px] uppercase tracking-[0.25em] text-crimson">Key findings</h4>
              {keyFindings.length === 0 ? (
                <p className="mt-3 text-sm text-obsidian/60">No inconsistencies found between the analysed documents.</p>
              ) : (
                <ul className="mt-3 divide-y divide-obsidian/10">
                  {keyFindings.map((f) => {
                    const kinds = findingKinds(f, isSeed);
                    const cite = f.citations[0];
                    return (
                      <li key={f.key} className="py-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold">{f.title}</span>
                          {kinds.map((k) => (
                            <span key={k.label} className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${k.cls}`}>
                              {k.label}
                            </span>
                          ))}
                        </div>
                        <p className="mt-1 text-sm text-obsidian/75">{f.detail}</p>
                        {cite && (
                          <p className="mt-1 text-xs text-obsidian/50">
                            “{cite.quote}” — {cite.filename}, p.{cite.page ?? "?"}
                            {f.citations.length > 1 && ` · +${f.citations.length - 1} more passage${f.citations.length > 2 ? "s" : ""}`}
                          </p>
                        )}
                        <button
                          type="button"
                          onClick={() => inspector.open({ kind: "finding", finding: f, workspaceId: state.workspaceId })}
                          className="print-hide mt-1 text-xs font-medium underline underline-offset-4 hover:text-crimson"
                        >
                          Inspect evidence
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}

            </>
          )}

          <ValidationSections />
        </Reveal>
      </div>
    </section>
  );
}
