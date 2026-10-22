"use client";

import { AiRunCard, ItemsTable } from "@/components/AiAnalysisPanel";
import { FindingList, LoadDemoButton } from "@/components/evidence";
import { Card, DemoNotice, PageHeader } from "@/components/ui";
import { Button } from "@/components/ui";
import { verifiedFactsOf } from "@/lib/checks";
import { consistencyFindingsCsv } from "@/lib/csv";
import { downloadCsv } from "@/lib/download";
import { useToday } from "@/lib/store";
import { useGapReport } from "@/lib/use-report";

export default function ConsistencyChecksPage() {
  const today = useToday();
  const { state, report, results: r } = useGapReport();
  const analysis = r.analysis;
  const findings = report.findings.filter((f) => f.provenance === "code");
  const items = analysis?.items ?? [];
  const facts = items.filter((i) => i.kind === "fact");
  const semantic = items.filter((i) => i.kind === "inconsistency");
  const missing = items.filter((i) => i.kind === "missing");
  const datesAndRevisions = verifiedFactsOf(analysis).filter(
    (f) => f.category === "document_date" || f.category === "document_revision",
  );

  return (
    <>
      <PageHeader
        title="Consistency Checks"
        subtitle="Compare device name, model, manufacturer, intended use, specifications, dates and revisions across documents. Exact comparisons use plain code; Gemini explains differences in meaning. A discrepancy is not a legal finding."
        actions={
          <Button onClick={() => downloadCsv("evidentra-consistency-findings.csv", consistencyFindingsCsv(report))} disabled={report.findings.length === 0}>
            Export findings CSV
          </Button>
        }
      />
      {state.isDemo && (
        <DemoNotice>
          FICTIONAL DEMO DOSSIER. The demo seed is hand-written; every quotation is checked against the demo PDFs.{" "}
          {!analysis && !r.loading && <LoadDemoButton onLoaded={r.refresh} />}
        </DemoNotice>
      )}
      {r.error && <p className="mb-4 text-sm text-bad">{r.error}</p>}

      {r.loading && <p className="mb-4 text-sm text-mute">Loading saved results…</p>}
      <AiRunCard
        workspaceId={state.workspaceId}
        aiConfigured={r.aiConfigured}
        model={r.model}
        analysis={analysis}
        onUpdated={r.refresh}
      />

      {analysis && (
        <div className="mt-4 space-y-4">
          <Card title={`Exact comparisons — deterministic code (${findings.length})`}>
            <p className="mb-3 text-xs text-mute">
              Uses only facts whose quotations were verified in the text. Values are compared after removing case,
              spacing and punctuation. Dates checked as of {today ?? "…"}.
            </p>
            <FindingList
              findings={findings}
              empty="No exact-value differences found among the verified facts. This does not prove the documents are consistent."
            />
          </Card>

          <Card title={`Differences in meaning — AI (${semantic.length})`}>
            <p className="mb-3 text-xs text-mute">Semantic comparisons proposed by the AI. Review each one.</p>
            <ItemsTable items={semantic} valueLabel="Explanation" />
          </Card>

          <Card title={`Document dates and revisions (${datesAndRevisions.length})`}>
            {datesAndRevisions.length === 0 ? (
              <p className="text-sm text-mute">No verified dates or revisions were extracted.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[600px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-line text-xs uppercase tracking-wide text-mute">
                      <th className="py-2 pr-3 font-medium">Document</th>
                      <th className="py-2 pr-3 font-medium">Field</th>
                      <th className="py-2 pr-3 font-medium">Value</th>
                      <th className="py-2 font-medium">Passage</th>
                    </tr>
                  </thead>
                  <tbody>
                    {datesAndRevisions.map((f) => (
                      <tr key={f.id} className="border-b border-line/60 last:border-0">
                        <td className="break-all py-2 pr-3 text-ink">{f.filename}</td>
                        <td className="py-2 pr-3 text-ink-soft">{f.label}</td>
                        <td className="py-2 pr-3 font-mono text-xs text-ink">
                          {f.value}
                          {f.normalizedDate && f.normalizedDate !== f.value && <span className="text-mute"> ({f.normalizedDate})</span>}
                        </td>
                        <td className="py-2 text-xs italic text-ink-soft">
                          &ldquo;{f.quote}&rdquo; — p.{f.page}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card title={`Extracted facts (${facts.length})`}>
            <ItemsTable items={facts} valueLabel="Extracted value" />
          </Card>

          <Card title={`Potential missing information (${missing.length})`}>
            <p className="mb-3 text-xs text-mute">
              &quot;Not found in the uploaded documents&quot; does not mean the information does not exist elsewhere.
            </p>
            <ItemsTable items={missing} valueLabel="Explanation" />
          </Card>
        </div>
      )}
    </>
  );
}
