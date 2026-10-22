"use client";

import { useState } from "react";
import { AnalyzeAction } from "@/components/AnalyzeAction";
import { FactDetail, FindingDetail, LoadDemoButton, ReviewState, SEVERITY, SourceLabel } from "@/components/evidence";
import { Button, Card, Disclosure, Drawer, EmptyState, Notice, PageHeader, Stat, StatusDot } from "@/components/ui";
import { categoryLabel } from "@/lib/analysis";
import { verifiedFactsOf } from "@/lib/checks";
import { consistencyFindingsCsv } from "@/lib/csv";
import { downloadCsv } from "@/lib/download";
import type { ReportFinding } from "@/lib/report";
import { aiItemKey } from "@/lib/review";
import { setQueryParam, useQueryParam } from "@/lib/use-query";
import { useGapReport } from "@/lib/use-report";

const SEVERITY_RANK = { high: 0, medium: 1, low: 2 } as const;

function FindingRow({ f }: { f: ReportFinding }) {
  const files = [...new Set(f.citations.map((c) => c.filename))];
  return (
    <li className={`flex flex-col gap-2 px-5 py-3.5 sm:flex-row sm:items-start ${f.dismissed ? "opacity-60" : ""}`}>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <StatusDot tone={SEVERITY[f.severity].tone} strong>
            {f.group === "missing_info" ? `Possible gap: ${f.title}` : f.title}
          </StatusDot>
          <SourceLabel kind={f.provenance} />
        </div>
        <p className="mt-1 line-clamp-2 text-sm text-ink-soft">{f.detail}</p>
        <div className="mt-1 text-xs text-mute">
          {files.length ? files.join(" · ") : "No passage — something could not be found"} · {SEVERITY[f.severity].label.toLowerCase()}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-3 sm:flex-col sm:items-end">
        <ReviewState review={f.review} basis={f.basis} />
        <Button size="sm" onClick={() => setQueryParam("item", f.key)}>
          Review
        </Button>
      </div>
    </li>
  );
}

export default function ConsistencyChecksPage() {
  const { state, set, report, results, loading, refresh } = useGapReport();
  const [showAll, setShowAll] = useState(false);
  const item = useQueryParam("item");
  const analysis = report.analysis;

  const findings = [...report.findings].sort(
    (a, b) =>
      Number(a.dismissed) - Number(b.dismissed) ||
      Number(a.group === "missing_info") - Number(b.group === "missing_info") ||
      SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity],
  );
  const live = findings.filter((f) => !f.dismissed);
  const needsReview = live.filter((f) => !f.humanReviewed);
  const shown = showAll ? findings : needsReview;
  const facts = analysis?.items.filter((i) => i.kind === "fact") ?? [];
  const datesAndRevisions = verifiedFactsOf(analysis).filter((f) => f.category === "document_date" || f.category === "document_revision");

  const openFinding = report.findings.find((f) => f.key === item) ?? null;
  const openFact = !openFinding && item ? facts.find((it) => aiItemKey(it) === item) ?? null : null;

  return (
    <>
      <PageHeader
        title="Consistency Checks"
        subtitle="Compares device name, model, manufacturer, intended use, specifications, dates and revisions across your documents. A difference is something to check, not a legal finding."
        actions={
          <Button onClick={() => downloadCsv("evidentra-consistency-findings.csv", consistencyFindingsCsv(report))} disabled={report.findings.length === 0}>
            Export CSV
          </Button>
        }
      />

      {loading ? (
        <p className="text-sm text-mute">Loading…</p>
      ) : !analysis ? (
        report.documents.usable === 0 ? (
          <EmptyState title="No readable documents yet">
            Upload PDFs on the Documents page first.
            {state.isDemo && (
              <div className="mt-3">
                <LoadDemoButton onLoaded={refresh} />
              </div>
            )}
          </EmptyState>
        ) : (
          <Card>
            <h2 className="text-sm font-semibold text-ink">Check your documents against each other</h2>
            <p className="mb-4 mt-1 text-sm text-ink-soft">No analysis yet. An empty page here does not mean your documents are consistent.</p>
            <AnalyzeAction
              workspaceId={state.workspaceId}
              set={set}
              aiConfigured={results.aiConfigured}
              readableDocs={report.documents.usable}
              hasResults={Boolean(report.mapping)}
              onDone={refresh}
            />
          </Card>
        )
      ) : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-4 rounded-xl border border-line bg-white px-5 py-4 sm:grid-cols-4">
            <Stat label="Findings" value={live.length} hint={report.counts.dismissed ? `${findings.length - live.length} dismissed` : undefined} />
            <Stat label="Need your review" value={needsReview.length} tone={needsReview.length ? "warn" : "neutral"} />
            <Stat label="High priority" value={live.filter((f) => f.severity === "high" && f.effectiveStatus !== "resolved").length} tone="bad" />
            <Stat label="Reviewed" value={live.filter((f) => f.humanReviewed).length} tone="teal" />
          </div>

          <Card className="p-0!">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-3">
              <h2 className="text-sm font-semibold text-ink">{showAll ? "All findings" : "Findings that need your review"}</h2>
              <Button size="sm" variant="ghost" onClick={() => setShowAll((v) => !v)}>
                {showAll ? "Show only those needing review" : `Show all (${findings.length})`}
              </Button>
            </div>
            {shown.length === 0 ? (
              <p className="px-5 py-6 text-sm text-ink-soft">
                {findings.length === 0
                  ? "No differences were found between the analyzed documents. That does not prove they are consistent."
                  : "Everything has been reviewed or dismissed."}
              </p>
            ) : (
              <ul className="divide-y divide-line">
                {shown.map((f) => (
                  <FindingRow key={f.key} f={f} />
                ))}
              </ul>
            )}
          </Card>

          <div className="mt-4 space-y-3">
            <Disclosure title="Document dates and revisions" count={datesAndRevisions.length}>
              {datesAndRevisions.length === 0 ? (
                <p className="text-sm text-mute">No dates or revisions were found with a verified quote.</p>
              ) : (
                <table className="w-full text-left text-sm">
                  <tbody>
                    {datesAndRevisions.map((f) => (
                      <tr key={f.id} className="border-b border-line/60 last:border-0">
                        <td className="break-all py-2 pr-3 text-ink">{f.filename}</td>
                        <td className="py-2 pr-3 text-ink-soft">{f.label}</td>
                        <td className="py-2 pr-3 font-mono text-xs text-ink">{f.value}</td>
                        <td className="py-2 text-xs text-mute">page {f.page}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Disclosure>

            <Disclosure title="Facts read from the documents" count={facts.length}>
              <p className="mb-3 text-xs text-mute">
                Each value was read by {analysis.source === "demo-seed" ? "hand for the demo" : "the AI"} and its quote checked against the document
                text. Select one to see the passage or review it.
              </p>
              <ul className="divide-y divide-line">
                {facts.map((it) => {
                  const c = it.citations[0];
                  return (
                    <li key={it.id}>
                      <button
                        type="button"
                        onClick={() => setQueryParam("item", aiItemKey(it))}
                        className="flex w-full flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2 text-left hover:bg-background focus:outline-none focus-visible:ring-2 focus-visible:ring-teal"
                      >
                        <span className="min-w-0">
                          <span className="text-xs text-mute">{categoryLabel(it.category)} · </span>
                          <span className="text-sm text-ink">{it.value}</span>
                        </span>
                        <span className="text-xs text-mute">
                          {c?.filename} · p.{c?.verifiedPage ?? c?.claimedPage ?? "?"}
                          {c && c.verifiedPage === null && <span className="text-bad"> · quote not found</span>}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </Disclosure>

            <Disclosure title="How these checks work">
              <div className="space-y-2 text-sm text-ink-soft">
                <p>
                  <strong className="text-ink">Automatically checked values</strong> compare identifiers, names, specifications, revisions and
                  validity dates exactly, using only facts whose quotes were found in the document text.
                </p>
                <p>
                  <strong className="text-ink">AI suggestions</strong> flag where descriptions may differ in meaning. They are proposals until you
                  review them.
                </p>
                <p>Every quotation is checked against the extracted text. Quotes that could not be found are marked and should not be relied on.</p>
                <p className="text-xs text-mute">
                  Source: {analysis.source === "demo-seed" ? "hand-written demo data" : `${analysis.model}, ${new Date(analysis.createdAt).toLocaleString()}`}
                  {analysis.skipped.length > 0 && ` · skipped: ${analysis.skipped.map((s) => `${s.filename} (${s.reason})`).join(", ")}`}
                </p>
              </div>
            </Disclosure>

            <Disclosure title="Re-analyze documents">
              <AnalyzeAction
                workspaceId={state.workspaceId}
                set={set}
                aiConfigured={results.aiConfigured}
                readableDocs={report.documents.usable}
                hasResults
                onDone={refresh}
              />
            </Disclosure>
          </div>
        </>
      )}

      {results.error && (
        <div className="mt-4">
          <Notice tone="bad" role="alert">
            {results.error}
          </Notice>
        </div>
      )}

      <Drawer
        open={Boolean(openFinding || openFact)}
        onClose={() => setQueryParam("item", null)}
        eyebrow={openFinding ? openFinding.kindLabel : openFact ? "Fact read from the documents" : null}
        title={openFinding ? openFinding.title : openFact ? openFact.field : ""}
      >
        {openFinding && <FindingDetail f={openFinding} />}
        {openFact && <FactDetail it={openFact} demo={analysis?.source === "demo-seed"} />}
      </Drawer>
    </>
  );
}
