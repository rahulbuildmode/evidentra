"use client";

import Link from "next/link";
import { AnalyzeAction } from "@/components/AnalyzeAction";
import { LoadDemoButton, SourceLabel } from "@/components/evidence";
import { Card, EmptyState, PageHeader, Stat } from "@/components/ui";
import { useGapReport } from "@/lib/use-report";

const PRIORITY_TEXT = { 1: "High priority", 2: "Medium priority", 3: "Low priority" } as const;

export default function OverviewPage() {
  const { state, set, reviews, report, results, uploads, loading, refresh } = useGapReport();
  const c = report.counts;
  const d = c.display;
  const unresolvedGaps =
    d.not_found + d.missing_confirmed + d.partial + d.conflicting + d.needs_review + c.discrepanciesOpen + c.discrepanciesConfirmed;
  const top = report.actions[0] ?? null;
  const analyzed = Boolean(report.mapping && report.analysis);
  const firstPending = report.awaitingReview[0];
  const pendingHref = firstPending
    ? "requirement" in firstPending
      ? `/evidence-matrix?item=${encodeURIComponent(firstPending.key)}`
      : `/consistency-checks?item=${encodeURIComponent(firstPending.key)}`
    : "/readiness-report";

  // Recent activity from real timestamps only.
  const titleOf = (key: string) =>
    report.requirements.find((r) => r.key === key)?.requirement.title ?? report.findings.find((f) => f.key === key)?.title ?? "an item";
  const activity = [
    ...uploads.uploads.map((u) => ({ at: u.uploadedAt, text: u.origin === "demo" ? `Demo file loaded: ${u.filename}` : `Uploaded ${u.filename}` })),
    ...(report.analysis
      ? [{ at: report.analysis.createdAt, text: report.analysis.source === "demo-seed" ? "Demo consistency data loaded" : `Documents analyzed (${report.analysis.model})` }]
      : []),
    ...(report.mapping
      ? [{ at: report.mapping.createdAt, text: report.mapping.source === "demo-seed" ? "Demo evidence matches loaded" : "Evidence matched to requirements" }]
      : []),
    ...Object.entries(reviews)
      .filter(([, r]) => r.updatedAt)
      .map(([k, r]) => ({ at: r.updatedAt, text: `${r.dismissedReason ? "Dismissed" : r.reviewed ? "Reviewed" : "Updated"}: ${titleOf(k)}` })),
  ]
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 5);

  return (
    <>
      <PageHeader title="Overview" subtitle="What needs your attention in this submission, and what to do next." />

      {loading ? (
        <p className="text-sm text-mute">Loading…</p>
      ) : report.documents.total === 0 ? (
        <EmptyState title="No documents in this workspace yet">
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            <Link href="/documents" className="rounded-md bg-teal px-3 py-2 text-sm font-medium text-white hover:bg-teal-dark">
              Upload documents
            </Link>
            {state.isDemo && <LoadDemoButton onLoaded={refresh} />}
          </div>
        </EmptyState>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 [&>*]:min-w-0">
          <Card className="lg:col-span-2">
            <div className="text-xs font-medium uppercase tracking-wide text-mute">Needs attention</div>
            {!analyzed ? (
              <>
                <h2 className="mt-2 text-lg font-semibold text-ink">Analyze your documents to find gaps and mismatches</h2>
                <p className="mt-1 text-sm text-ink-soft">
                  {report.documents.usable} readable document(s) are ready. The analysis reads them, checks them against each other and
                  matches evidence to the requirement list.
                </p>
                <div className="mt-4">
                  <AnalyzeAction
                    workspaceId={state.workspaceId}
                    set={set}
                    aiConfigured={results.aiConfigured}
                    readableDocs={report.documents.usable}
                    hasResults={Boolean(report.mapping || report.analysis)}
                    onDone={refresh}
                  />
                </div>
              </>
            ) : top ? (
              <>
                <h2 className="mt-2 text-lg font-semibold text-ink">{top.title}</h2>
                <p className="mt-1 text-sm text-ink-soft">{top.reason}</p>
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-mute">
                  <span>{PRIORITY_TEXT[top.priority]}</span>
                  <SourceLabel kind={top.provenance} />
                </div>
                <p className="mt-3 text-sm">
                  <span className="font-medium text-ink">Next step: </span>
                  <span className="text-ink-soft">{top.action}</span>
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link href={c.awaitingReview ? pendingHref : top.href} className="rounded-md bg-teal px-3 py-2 text-sm font-medium text-white hover:bg-teal-dark">
                    {c.awaitingReview ? `Review findings (${c.awaitingReview})` : "Open this finding"}
                  </Link>
                  <Link href="/readiness-report" className="rounded-md border border-line px-3 py-2 text-sm font-medium text-ink hover:bg-background">
                    Open gap report
                  </Link>
                </div>
              </>
            ) : (
              <>
                <h2 className="mt-2 text-lg font-semibold text-ink">No open gaps or discrepancies</h2>
                <p className="mt-1 text-sm text-ink-soft">A qualified reviewer should still review the full submission.</p>
                <Link href="/readiness-report" className="mt-4 inline-block rounded-md bg-teal px-3 py-2 text-sm font-medium text-white hover:bg-teal-dark">
                  Open gap report
                </Link>
              </>
            )}
          </Card>

          <Card>
            <div className="grid grid-cols-3 gap-3 lg:grid-cols-1 lg:gap-5">
              <Stat label="Awaiting your review" value={analyzed ? c.awaitingReview : "—"} tone={c.awaitingReview ? "warn" : "neutral"} />
              <Stat label="Unresolved gaps and mismatches" value={analyzed ? unresolvedGaps : "—"} tone={unresolvedGaps ? "bad" : "neutral"} />
              <Stat label="Readable documents" value={`${report.documents.usable} / ${report.documents.total}`} />
            </div>
          </Card>

          <Card title="Recent activity" className="lg:col-span-2">
            {activity.length === 0 ? (
              <p className="text-sm text-mute">No activity yet.</p>
            ) : (
              <ul className="divide-y divide-line text-sm">
                {activity.map((a, i) => (
                  <li key={i} className="flex items-baseline justify-between gap-3 py-2">
                    <span className="min-w-0 truncate text-ink">{a.text}</span>
                    <span className="shrink-0 text-xs text-mute">{new Date(a.at).toLocaleString()}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Submission" actions={<Link href="/workspace" className="text-xs font-medium text-teal-dark hover:underline">Edit</Link>}>
            <dl className="space-y-1.5 text-sm">
              {(
                [
                  ["Model", state.workspace.modelNumber.value],
                  ["Manufacturer", state.workspace.manufacturer.value],
                  ["Class", state.workspace.classification.value],
                  ["Requirements", set.verification === "official_text" ? "Official (MDR 2017 selection)" : "Demo checklist"],
                ] as const
              ).map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3">
                  <dt className="text-mute">{k}</dt>
                  <dd className="truncate text-right text-ink">{v || "—"}</dd>
                </div>
              ))}
            </dl>
            {report.applicability && !report.applicability.applicable && (
              <p className="mt-3 text-xs text-warn">We need to confirm whether the official requirements apply to this device and pathway.</p>
            )}
          </Card>
        </div>
      )}
    </>
  );
}
