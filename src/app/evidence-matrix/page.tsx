"use client";

import { AnalyzeAction } from "@/components/AnalyzeAction";
import { DISPLAY_TONE, LoadDemoButton, RequirementDetail, ReviewState, SourceLabel } from "@/components/evidence";
import { Button, Card, Disclosure, Drawer, EmptyState, Notice, PageHeader, StatusDot } from "@/components/ui";
import { evidenceMatrixCsv } from "@/lib/csv";
import { downloadCsv } from "@/lib/download";
import { DISPLAY_LABEL, DISPLAY_ORDER } from "@/lib/report";
import { REQUIREMENT_SETS } from "@/lib/requirements";
import { actions } from "@/lib/store";
import { setQueryParam, useQueryParam } from "@/lib/use-query";
import { useGapReport } from "@/lib/use-report";

export default function EvidenceReviewPage() {
  const { state, set, report, results, loading, refresh } = useGapReport();
  const item = useQueryParam("item");
  const open = report.requirements.find((r) => r.key === item) ?? null;
  const applicability = report.applicability;
  const mappingForOtherSet = results.mapping && results.mapping.requirementSetId !== set.id;
  const counts = report.counts.display;

  return (
    <>
      <PageHeader
        title="Evidence Review"
        subtitle="Each requirement and the evidence found for it. Select a row to see the supporting passage and record your review."
        actions={
          <Button onClick={() => downloadCsv("evidentra-evidence-matrix.csv", evidenceMatrixCsv(report))} disabled={!report.mapping}>
            Export CSV
          </Button>
        }
      />

      <Card className="mb-4">
        <div className="flex flex-wrap items-center gap-3">
          <label htmlFor="req-set" className="text-sm font-medium text-ink">
            Requirement list
          </label>
          <select
            id="req-set"
            value={set.id}
            onChange={(e) => actions.setRequirementSet(e.target.value)}
            className="w-full min-w-0 rounded-md border border-line bg-white px-3 py-2 text-sm text-ink focus:border-teal focus:outline-none focus-visible:ring-2 focus-visible:ring-teal/40 sm:w-auto sm:max-w-md"
          >
            {REQUIREMENT_SETS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <SourceLabel kind={set.verification === "official_text" ? "official" : "synthetic"} />
        </div>
        {applicability && !applicability.applicable && (
          <p className="mt-3 text-sm text-warn">
            We need to confirm whether this requirement list applies to this device and pathway. Rows are shown for reference only.
          </p>
        )}
        <details className="mt-3 text-xs text-ink-soft">
          <summary className="cursor-pointer text-teal-dark">About this requirement list</summary>
          <p className="mt-2 leading-relaxed">{set.verificationNote}</p>
          {set.sourceUrl && (
            <a href={set.sourceUrl} target="_blank" rel="noreferrer" className="mt-1 inline-block text-teal-dark underline">
              {set.sourceName} ↗
            </a>
          )}
          {applicability && <p className="mt-2">Scope check: {applicability.reason}</p>}
        </details>
      </Card>

      {loading ? (
        <p className="text-sm text-mute">Loading…</p>
      ) : report.documents.usable === 0 ? (
        <EmptyState title="No readable documents yet">
          Upload PDFs on the Documents page first.
          {state.isDemo && (
            <div className="mt-3">
              <LoadDemoButton onLoaded={refresh} />
            </div>
          )}
        </EmptyState>
      ) : !report.mapping ? (
        <Card>
          <h2 className="text-sm font-semibold text-ink">Match evidence to requirements</h2>
          <p className="mb-4 mt-1 text-sm text-ink-soft">
            {mappingForOtherSet
              ? "Evidence was matched for a different requirement list. Run the match for this list."
              : "No evidence has been matched yet. Nothing here means evidence is missing."}
          </p>
          <AnalyzeAction
            workspaceId={state.workspaceId}
            set={set}
            aiConfigured={results.aiConfigured}
            readableDocs={report.documents.usable}
            hasResults={false}
            onDone={refresh}
            steps={report.analysis ? ["mapping"] : ["analysis", "mapping"]}
            label={report.analysis ? "Match evidence" : "Analyze documents"}
          />
        </Card>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
            {DISPLAY_ORDER.filter((s) => counts[s] > 0).map((s) => (
              <StatusDot key={s} tone={DISPLAY_TONE[s]}>
                {counts[s]} {DISPLAY_LABEL[s].toLowerCase()}
              </StatusDot>
            ))}
            <span className="text-xs text-mute">
              · {report.mapping.source === "demo-seed" ? "demo data" : `AI match ${new Date(report.mapping.createdAt).toLocaleDateString()}`}
            </span>
          </div>

          <Card className="p-0!">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm sm:min-w-[620px]">
                <thead>
                  <tr className="border-b border-line text-xs text-mute">
                    <th className="px-3 py-2.5 font-medium sm:px-5">Requirement</th>
                    <th className="px-3 py-2.5 font-medium">Evidence</th>
                    <th className="hidden px-3 py-2.5 font-medium sm:table-cell">Supporting document</th>
                    <th className="px-3 py-2.5 font-medium sm:px-5">Review</th>
                  </tr>
                </thead>
                <tbody>
                  {report.requirements.map((r) => {
                    const first = r.citations[0];
                    return (
                      <tr
                        key={r.key}
                        className={`cursor-pointer border-b border-line/60 align-top last:border-0 hover:bg-background/70 ${r.dismissed ? "opacity-60" : ""}`}
                        onClick={() => setQueryParam("item", r.key)}
                      >
                        <td className="px-3 py-3 sm:px-5">
                          <button
                            type="button"
                            className="text-left font-medium text-ink hover:text-teal-dark focus:outline-none focus-visible:underline"
                            onClick={(e) => {
                              e.stopPropagation();
                              setQueryParam("item", r.key);
                            }}
                          >
                            {r.requirement.title}
                          </button>
                          <div className="font-mono text-[11px] text-mute">{r.requirement.id}</div>
                        </td>
                        <td className="px-3 py-3">
                          <StatusDot tone={DISPLAY_TONE[r.display]}>{DISPLAY_LABEL[r.display]}</StatusDot>
                        </td>
                        <td className="hidden px-3 py-3 text-xs text-ink-soft sm:table-cell">
                          {first ? (
                            <>
                              <span className="break-all">{first.filename}</span>
                              <span className="text-mute"> · p.{first.page ?? "?"}</span>
                              {r.citations.length > 1 && <span className="text-mute"> · +{r.citations.length - 1} more</span>}
                              {r.citations.some((c) => !c.verified) && <div className="text-bad">Unverified quote</div>}
                            </>
                          ) : (
                            <span className="text-mute">—</span>
                          )}
                        </td>
                        <td className="px-3 py-3 sm:px-5">
                          <ReviewState review={r.review} basis={r.basis} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          <div className="mt-4">
            <Disclosure title="Re-run the evidence match">
              <AnalyzeAction
                workspaceId={state.workspaceId}
                set={set}
                aiConfigured={results.aiConfigured}
                readableDocs={report.documents.usable}
                hasResults
                onDone={refresh}
                steps={["mapping"]}
                label="Re-match evidence"
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
        open={Boolean(open)}
        onClose={() => setQueryParam("item", null)}
        eyebrow={open ? <span className="font-mono">{open.requirement.id}</span> : null}
        title={open?.requirement.title ?? ""}
      >
        {open && <RequirementDetail r={open} applicable={applicability ? applicability.applicable : null} />}
      </Drawer>
    </>
  );
}
