"use client";

import { actionListCsv } from "@/lib/csv";
import { downloadCsv } from "@/lib/download";
import { DISPLAY_LABEL, type ReportFinding } from "@/lib/report";
import { useGapReport } from "@/lib/use-report";
import { ChapterHead } from "./Chapter";
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
  const c = report.counts;
  const isSeed = report.analysis?.source === "demo-seed" || report.mapping?.source === "demo-seed";
  const device =
    report.analysis?.items.find((i) => i.kind === "fact" && i.category === "device_name" && i.citations[0]?.verifiedPage !== null)?.value ??
    (state.isDemo ? state.workspace.deviceName.value : "") ??
    "";
  const keyFindings = report.findings.filter((f) => f.group === "discrepancy" && !f.dismissed && f.effectiveStatus !== "resolved");
  const notFound = report.requirements.filter((r) => ["not_found", "needs_review", "partial", "conflicting", "missing_confirmed"].includes(r.display));
  const possibleGaps = report.findings.filter((f) => f.group === "missing_info" && !f.dismissed);
  const actions = report.actions.slice(0, 6);
  const official = report.set.verification === "official_text";
  const analysed = Boolean(report.analysis || report.mapping);

  const summary = !analysed
    ? `${plural(report.documents.total, "document")} in the dossier; not analysed yet.`
    : `${plural(report.documents.usable, "readable document")} analysed. ${plural(keyFindings.length, "inconsistency", "inconsistencies")}, ${plural(
        notFound.length + possibleGaps.length,
        "unresolved issue",
      )}, ${c.awaitingReview} item${c.awaitingReview === 1 ? "" : "s"} awaiting human review.`;

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
                disabled={!analysed}
                onClick={() => downloadCsv("evidentra-readiness-brief.csv", actionListCsv(report))}
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
                      </li>
                    );
                  })}
                </ul>
              )}

              <h4 className="mt-10 font-mono text-[11px] uppercase tracking-[0.25em] text-crimson">Unresolved issues</h4>
              <ul className="mt-3 space-y-3 text-sm">
                {notFound.map((r) => (
                  <li key={r.key}>
                    <span className="font-medium">{r.requirement.title}</span> <span className="font-mono text-xs text-obsidian/45">{r.requirement.id}</span>
                    <div className="text-obsidian/65">
                      {DISPLAY_LABEL[r.display]}
                      {r.display === "not_found" && " — not proof that it is missing; confirm before acting."}
                    </div>
                  </li>
                ))}
                {possibleGaps.map((f) => (
                  <li key={f.key}>
                    <span className="font-medium">Possible gap: {f.title}</span>
                    <div className="text-obsidian/65">Not found in the uploaded text — it may exist elsewhere.</div>
                  </li>
                ))}
                {report.questions.map((q) => (
                  <li key={q.id}>
                    <span className="font-medium">{q.question}</span>
                    <div className="text-obsidian/65">{q.why}</div>
                  </li>
                ))}
              </ul>

              <h4 className="mt-10 font-mono text-[11px] uppercase tracking-[0.25em] text-crimson">Recommended next actions</h4>
              {actions.length === 0 ? (
                <p className="mt-3 text-sm text-obsidian/60">No open actions. A qualified person should still review the full dossier.</p>
              ) : (
                <ol className="mt-3 space-y-3">
                  {actions.map((a, i) => (
                    <li key={a.id} className="flex gap-4">
                      <span className="font-mono text-sm font-bold text-obsidian/30">{String(i + 1).padStart(2, "0")}</span>
                      <div className="text-sm">
                        <div className="font-medium">{a.action}</div>
                        <div className="text-obsidian/55">{a.title}</div>
                      </div>
                    </li>
                  ))}
                </ol>
              )}

              <h4 className="mt-10 font-mono text-[11px] uppercase tracking-[0.25em] text-crimson">Regulatory references</h4>
              {official ? (
                <>
                  <p className="mt-3 rounded-xl bg-porcelain px-4 py-3 text-sm text-obsidian/75">
                    Checked against the CDSCO-published Medical Devices Rules, 2017 text (as amended to 14 Oct 2022). Whether these apply to your
                    device class and pathway is <strong>unresolved</strong> — confirm with a qualified person. Later amendments were not reviewed.
                  </p>
                  <ul className="mt-3 divide-y divide-obsidian/10 text-sm">
                    {report.requirements.map((r) => (
                      <li key={r.key} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2.5">
                        <span>
                          <span className="font-medium">{r.requirement.title}</span>
                          <span className="ml-2 font-mono text-[11px] text-obsidian/45">{r.requirement.sourceLocation}</span>
                        </span>
                        <span className="text-xs text-obsidian/60">{DISPLAY_LABEL[r.display]}</span>
                      </li>
                    ))}
                  </ul>
                  {report.set.sourceUrl && (
                    <a href={report.set.sourceUrl} target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs underline underline-offset-4">
                      {report.set.sourceName} ↗
                    </a>
                  )}
                </>
              ) : (
                <p className="mt-3 text-sm text-obsidian/60">
                  This dossier uses a synthetic demo checklist, so no official regulatory references apply. Start your own dossier to check against the
                  verified MDR 2017 items.
                </p>
              )}
            </>
          )}
        </Reveal>
      </div>
    </section>
  );
}
