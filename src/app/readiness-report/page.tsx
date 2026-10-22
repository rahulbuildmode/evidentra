"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { CitationList, DISPLAY_TONE, FindingDetail, LoadDemoButton, RequirementDetail, ReviewState, SEVERITY, SourceLabel } from "@/components/evidence";
import { Button, Disclosure, Drawer, EmptyState, StatusDot } from "@/components/ui";
import { actionListCsv, consistencyFindingsCsv, evidenceMatrixCsv } from "@/lib/csv";
import { downloadCsv } from "@/lib/download";
import { DISPLAY_LABEL, DISPLAY_ORDER, type ReportAction, type ReportFinding, type RequirementRow } from "@/lib/report";
import { reviewActions } from "@/lib/review-store";
import type { WorkspaceFieldKey } from "@/lib/types";
import { setQueryParam, useQueryParam } from "@/lib/use-query";
import { useGapReport } from "@/lib/use-report";

const LABELS: Record<WorkspaceFieldKey, string> = {
  deviceName: "Device name",
  manufacturer: "Manufacturer",
  modelNumber: "Model number",
  intendedUse: "Intended use",
  classification: "Classification",
  pathway: "Regulatory pathway",
};
const PRIORITY = {
  1: { label: "High priority", tone: "bad" as const },
  2: { label: "Medium priority", tone: "warn" as const },
  3: { label: "Low priority", tone: "neutral" as const },
};
const opensDrawer = (key: string) => /^(req|cc|ai):/.test(key);
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

function SummaryList({ title, rows }: { title: string; rows: { label: string; value: number; tone?: Parameters<typeof StatusDot>[0]["tone"] }[] }) {
  return (
    <div>
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-mute">{title}</div>
      <ul className="space-y-1 text-sm">
        {rows.map((r) => (
          <li key={r.label} className="flex items-center justify-between gap-3">
            <StatusDot tone={r.value ? r.tone ?? "neutral" : "neutral"}>{r.label}</StatusDot>
            <span className={`tabular-nums ${r.value ? "font-medium text-ink" : "text-mute"}`}>{r.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ActionItem({ a, hiddenOnScreen }: { a: ReportAction; hiddenOnScreen: boolean }) {
  const cite = a.citations[0];
  return (
    <li className={`${hiddenOnScreen ? "hidden print:flex" : "flex"} flex-col gap-2 px-5 py-4 sm:flex-row sm:items-start`}>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <StatusDot tone={PRIORITY[a.priority].tone} strong>
            {a.title}
          </StatusDot>
          <SourceLabel kind={a.provenance} />
          {a.ref && <span className="font-mono text-[11px] text-mute">{a.ref}</span>}
        </div>
        {a.reason && <p className="mt-1 text-sm text-ink-soft">{a.reason}</p>}
        <p className="mt-1 text-sm">
          <span className="font-medium text-ink">Next step: </span>
          <span className="text-ink-soft">{a.action}</span>
        </p>
        {cite && (
          <p className="mt-1 text-xs text-mute">
            Evidence: &ldquo;{cite.quote.length > 90 ? `${cite.quote.slice(0, 90)}…` : cite.quote}&rdquo; — {cite.filename}, p.{cite.page ?? "?"}
            {!cite.verified && <span className="text-bad"> (quote not verified)</span>}
            {a.citations.length > 1 && ` · +${a.citations.length - 1} more`}
          </p>
        )}
      </div>
      <div className="no-print flex shrink-0 items-center gap-3 sm:flex-col sm:items-end">
        <span className="text-xs text-mute">{PRIORITY[a.priority].label}</span>
        {opensDrawer(a.itemKey) ? (
          <Button size="sm" onClick={() => setQueryParam("item", a.itemKey)}>
            Review
          </Button>
        ) : (
          <Link href={a.href} className="rounded-md border border-line px-2.5 py-1 text-xs font-medium text-ink hover:bg-background">
            Open
          </Link>
        )}
      </div>
    </li>
  );
}

function ItemRow({ title, sub, right, onOpen, dimmed }: { title: ReactNode; sub?: ReactNode; right?: ReactNode; onOpen: () => void; dimmed?: boolean }) {
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className={`flex w-full flex-wrap items-start justify-between gap-x-4 gap-y-1 rounded-md px-2 py-2 text-left hover:bg-background focus:outline-none focus-visible:ring-2 focus-visible:ring-teal ${dimmed ? "opacity-60" : ""}`}
      >
        <span className="min-w-0">
          <span className="block text-sm text-ink">{title}</span>
          {sub && <span className="block text-xs text-mute">{sub}</span>}
        </span>
        {right}
      </button>
    </li>
  );
}

export default function GapReportPage() {
  const { state, reviews, report, loading, refresh } = useGapReport();
  const [showAllActions, setShowAllActions] = useState(false);
  const item = useQueryParam("item");
  const c = report.counts;
  const d = c.display;

  // Print the whole report: open every collapsed section first.
  useEffect(() => {
    const openAll = () => document.querySelectorAll("details").forEach((el) => (el.open = true));
    window.addEventListener("beforeprint", openAll);
    return () => window.removeEventListener("beforeprint", openAll);
  }, []);

  const openReq: RequirementRow | null = report.requirements.find((r) => r.key === item) ?? null;
  const openFinding: ReportFinding | null = report.findings.find((f) => f.key === item) ?? null;
  const discrepancies = report.findings.filter((f) => f.group === "discrepancy");
  const missingInfo = report.findings.filter((f) => f.group === "missing_info");
  const assessed = report.requirements.filter((r) => r.display !== "not_assessed").length;
  const analyzed = Boolean(report.mapping || report.analysis);
  const top = report.actions[0] ?? null;
  const reviewTotal = c.reviewed + c.awaitingReview;
  const pct = reviewTotal ? Math.round((c.reviewed / reviewTotal) * 100) : 0;

  const citationIndex = [
    ...new Map(
      [
        ...report.requirements.flatMap((r) => r.citations.map((x) => ({ ...x, usedBy: r.requirement.title }))),
        ...report.findings.flatMap((f) => f.citations.map((x) => ({ ...x, usedBy: f.title }))),
      ].map((x) => [`${x.filename}|${x.page}|${x.quote}`, x]),
    ).values(),
  ].sort((a, b) => a.filename.localeCompare(b.filename) || (a.page ?? 0) - (b.page ?? 0));

  // One plain sentence describing the current state, from real counts only.
  const evidenceParts = [
    d.found && `${d.found} with evidence`,
    d.partial && `${d.partial} partial`,
    d.not_found && `${d.not_found} not found`,
    d.missing_confirmed && `${d.missing_confirmed} confirmed missing`,
    d.conflicting && `${d.conflicting} conflicting`,
    d.needs_review && `${d.needs_review} needing closer review`,
  ].filter(Boolean);
  const summary = !analyzed
    ? `${plural(report.documents.total, "document")} uploaded; not analyzed yet.`
    : `${plural(report.documents.usable, "readable document")} checked against ${plural(assessed, "requirement")}${
        evidenceParts.length ? `: ${evidenceParts.join(", ")}` : ""
      }. ${plural(c.discrepanciesOpen + c.discrepanciesConfirmed, "cross-document difference")} still open, ${c.awaitingReview} item${c.awaitingReview === 1 ? "" : "s"} awaiting review.`;
  const limitation =
    report.set.verification === "synthetic_demo"
      ? "Demo checklist: no official requirements were checked."
      : report.applicability && !report.applicability.applicable
        ? "We need to confirm whether the official requirements apply to this device and pathway."
        : "Official requirements were checked against the MDR 2017 text as amended to 14 Oct 2022; later amendments were not reviewed.";

  const reviewHistory = Object.entries(reviews)
    .filter(([, r]) => r.updatedAt)
    .sort((a, b) => b[1].updatedAt.localeCompare(a[1].updatedAt))
    .map(([key, r]) => ({
      key,
      r,
      title: report.requirements.find((x) => x.key === key)?.requirement.title ?? report.findings.find((x) => x.key === key)?.title ?? key,
    }));

  return (
    <article className="space-y-6 pb-12">
      <header className="rounded-xl border border-line bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-xs font-medium uppercase tracking-widest text-teal-dark">Pre-submission documentation gap report</div>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink">{state.workspace.deviceName.value || "Untitled device"}</h1>
            <p className="mt-1 text-sm text-ink-soft">
              {state.workspace.manufacturer.value || "Manufacturer not set"} · Model {state.workspace.modelNumber.value || "—"}
              {report.isDemo && <span className="text-demo"> · fictional demo data</span>}
            </p>
            <p className="mt-1 text-xs text-mute">Generated {report.generatedFor || "…"} from the current workspace</p>
          </div>
          <div className="no-print flex flex-wrap gap-2">
            <Button size="sm" onClick={() => downloadCsv("evidentra-evidence-matrix.csv", evidenceMatrixCsv(report))}>
              Evidence CSV
            </Button>
            <Button size="sm" onClick={() => downloadCsv("evidentra-consistency-findings.csv", consistencyFindingsCsv(report))}>
              Findings CSV
            </Button>
            <Button size="sm" onClick={() => downloadCsv("evidentra-action-list.csv", actionListCsv(report))}>
              Actions CSV
            </Button>
            <Button size="sm" variant="primary" onClick={() => window.print()}>
              Print / PDF
            </Button>
          </div>
        </div>
        <p className="mt-4 text-xs text-mute">
          This report lists documentation gaps and differences for a qualified reviewer. It does not certify compliance, is not legal advice, and
          does not predict or guarantee CDSCO approval.
        </p>
      </header>

      {loading ? (
        <p className="text-sm text-mute">Loading report…</p>
      ) : report.documents.total === 0 ? (
        <EmptyState title="Nothing to report yet">
          Upload documents and analyze them first.
          {state.isDemo && (
            <div className="mt-3">
              <LoadDemoButton onLoaded={refresh} />
            </div>
          )}
        </EmptyState>
      ) : (
        <>
          {/* A. One-screen answer */}
          <section aria-labelledby="summary-h" className="rounded-xl border border-line bg-white p-6">
            <h2 id="summary-h" className="text-xs font-semibold uppercase tracking-wide text-mute">
              Submission review summary
            </h2>
            <p className="mt-2 text-lg leading-snug text-ink">{summary}</p>
            <p className={`mt-2 text-sm ${report.set.verification === "official_text" && report.applicability?.applicable ? "text-ink-soft" : "text-warn"}`}>{limitation}</p>

            <div className="mt-5 grid gap-5 border-t border-line pt-5 md:grid-cols-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-mute">Needs attention</div>
                {top ? (
                  <>
                    <p className="mt-1 font-medium text-ink">{top.title}</p>
                    {top.reason && <p className="mt-0.5 line-clamp-3 text-sm text-ink-soft">{top.reason}</p>}
                    {opensDrawer(top.itemKey) ? (
                      <button type="button" className="no-print mt-1 text-sm font-medium text-teal-dark hover:underline" onClick={() => setQueryParam("item", top.itemKey)}>
                        View the evidence →
                      </button>
                    ) : (
                      <Link href={top.href} className="no-print mt-1 inline-block text-sm font-medium text-teal-dark hover:underline">
                        Open →
                      </Link>
                    )}
                  </>
                ) : (
                  <p className="mt-1 text-sm text-ink-soft">{analyzed ? "No open gaps or differences." : "Analyze the documents first."}</p>
                )}
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-mute">Next action</div>
                <p className="mt-1 text-sm text-ink">{top ? top.action : analyzed ? "Ask a qualified person to review the full submission." : "Run “Analyze documents” on the Overview page."}</p>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-mute">Review progress</div>
                <p className="mt-1 text-sm text-ink">
                  {c.reviewed} of {reviewTotal} reviewed
                </p>
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-line" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Review progress">
                  <div className="h-full bg-teal" style={{ width: `${pct}%` }} />
                </div>
                <p className="mt-1 text-xs text-mute">
                  {c.dismissed ? `${c.dismissed} dismissed · ` : ""}
                  {c.changedSinceReview ? `${c.changedSinceReview} changed since review` : "Nothing changed since review"}
                </p>
              </div>
            </div>
          </section>

          {/* B. Grouped counts */}
          <section aria-label="Counts" className="grid gap-6 rounded-xl border border-line bg-white p-6 md:grid-cols-3">
            <SummaryList
              title="Evidence"
              rows={DISPLAY_ORDER.map((s) => ({ label: DISPLAY_LABEL[s], value: d[s], tone: DISPLAY_TONE[s] }))}
            />
            <SummaryList
              title="Cross-document differences"
              rows={[
                { label: "Open", value: c.discrepanciesOpen, tone: "bad" },
                { label: "Confirmed — needs fixing", value: c.discrepanciesConfirmed, tone: "warn" },
                { label: "Resolved", value: c.discrepanciesResolved, tone: "teal" },
                { label: "Possible missing information", value: c.missingInfoOpen, tone: "warn" },
              ]}
            />
            <SummaryList
              title="Human review"
              rows={[
                { label: "Awaiting review", value: c.awaitingReview, tone: "warn" },
                { label: "Reviewed", value: c.reviewed, tone: "teal" },
                { label: "Dismissed as false positive", value: c.dismissed },
                { label: "Changed since review", value: c.changedSinceReview, tone: "warn" },
              ]}
            />
          </section>

          {/* C1. Findings requiring attention */}
          <section aria-labelledby="actions-h" className="rounded-xl border border-line bg-white">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-3">
              <h2 id="actions-h" className="text-sm font-semibold text-ink">
                Findings requiring attention <span className="font-normal text-mute">{report.actions.length}</span>
              </h2>
              <span className="text-xs text-mute">Ordered by priority: conflicts and unreadable files first, then gaps, then checks.</span>
            </div>
            {report.actions.length === 0 ? (
              <p className="px-5 py-6 text-sm text-ink-soft">No open actions. Dismissed and resolved items are not listed.</p>
            ) : (
              <>
                <ul className="divide-y divide-line">
                  {report.actions.map((a, i) => (
                    <ActionItem key={a.id} a={a} hiddenOnScreen={!showAllActions && i >= 5} />
                  ))}
                </ul>
                {report.actions.length > 5 && (
                  <div className="no-print border-t border-line px-5 py-2">
                    <Button size="sm" variant="ghost" onClick={() => setShowAllActions((v) => !v)}>
                      {showAllActions ? "Show the top 5 only" : `Show all ${report.actions.length} actions`}
                    </Button>
                  </div>
                )}
              </>
            )}
          </section>

          {/* C2. Evidence and consistency details */}
          <section id="details" aria-label="Evidence and consistency details" className="space-y-3">
            <h2 className="pt-2 text-sm font-semibold text-ink">Evidence and consistency details</h2>
            <Disclosure title="Requirements and their evidence" count={report.requirements.length}>
              {!report.mapping ? (
                <p className="text-sm text-mute">Evidence has not been matched for this requirement list yet.</p>
              ) : (
                <div className="space-y-4">
                  {DISPLAY_ORDER.map((s) => {
                    const rows = report.requirements.filter((r) => r.display === s);
                    if (!rows.length) return null;
                    return (
                      <div key={s}>
                        <StatusDot tone={DISPLAY_TONE[s]} strong>
                          {DISPLAY_LABEL[s]} · {rows.length}
                        </StatusDot>
                        <ul className="mt-1">
                          {rows.map((r) => (
                            <ItemRow
                              key={r.key}
                              dimmed={r.dismissed}
                              onOpen={() => setQueryParam("item", r.key)}
                              title={r.requirement.title}
                              sub={
                                <>
                                  <span className="font-mono">{r.requirement.id}</span>
                                  {r.citations[0] && ` · ${r.citations[0].filename}, p.${r.citations[0].page ?? "?"}`}
                                </>
                              }
                              right={<ReviewState review={r.review} basis={r.basis} />}
                            />
                          ))}
                        </ul>
                      </div>
                    );
                  })}
                </div>
              )}
            </Disclosure>

            <Disclosure title="Cross-document differences" count={discrepancies.length}>
              {discrepancies.length === 0 ? (
                <p className="text-sm text-mute">{report.analysis ? "No differences found between the analyzed documents." : "No consistency analysis yet."}</p>
              ) : (
                <ul>
                  {discrepancies.map((f) => (
                    <ItemRow
                      key={f.key}
                      dimmed={f.dismissed}
                      onOpen={() => setQueryParam("item", f.key)}
                      title={f.title}
                      sub={`${SEVERITY[f.severity].label} · ${f.kindLabel}`}
                      right={<ReviewState review={f.review} basis={f.basis} />}
                    />
                  ))}
                </ul>
              )}
            </Disclosure>

            {missingInfo.length > 0 && (
              <Disclosure title="Possible missing information" count={missingInfo.length}>
                <ul>
                  {missingInfo.map((f) => (
                    <ItemRow key={f.key} dimmed={f.dismissed} onOpen={() => setQueryParam("item", f.key)} title={f.title} sub={f.detail} right={<ReviewState review={f.review} basis={f.basis} />} />
                  ))}
                </ul>
              </Disclosure>
            )}

            <Disclosure title="Questions to confirm before relying on this report" count={report.questions.length}>
              {report.questions.length === 0 ? (
                <p className="text-sm text-mute">None identified.</p>
              ) : (
                <ol className="list-decimal space-y-2 pl-5 text-sm">
                  {report.questions.map((q) => (
                    <li key={q.id}>
                      <span className="text-ink">{q.question}</span>
                      <div className="text-xs text-mute">{q.why}</div>
                    </li>
                  ))}
                </ol>
              )}
            </Disclosure>

            <Disclosure title="All cited files, pages and quotations" count={citationIndex.length}>
              <CitationList citations={citationIndex} empty="No passages cited." />
            </Disclosure>
          </section>

          {/* C3. Submission details, methodology and review history */}
          <section aria-label="Submission details and methodology" className="space-y-3">
            <h2 className="pt-2 text-sm font-semibold text-ink">Submission details and methodology</h2>
            <Disclosure title="Product and documents">
              <div className="grid gap-6 md:grid-cols-2">
                <dl className="space-y-1.5 text-sm">
                  {(Object.keys(LABELS) as WorkspaceFieldKey[]).map((k) => (
                    <div key={k} className="flex items-start justify-between gap-4">
                      <dt className="text-mute">{LABELS[k]}</dt>
                      <dd className="text-right text-ink">
                        {state.workspace[k].value || "—"}
                        <span className={`block text-xs ${state.workspace[k].verified ? "text-teal-dark" : "text-warn"}`}>
                          {state.workspace[k].verified ? "Confirmed" : "Not confirmed"}
                        </span>
                      </dd>
                    </div>
                  ))}
                </dl>
                <ul className="space-y-1.5 text-sm">
                  {(report.analysis?.documents ?? []).map((doc) => (
                    <li key={doc.id} className="flex justify-between gap-3">
                      <span className="break-all text-ink">{doc.filename}</span>
                      <span className="shrink-0 text-xs text-mute">{plural(doc.pageCount, "page")}</span>
                    </li>
                  ))}
                  {report.documents.unusable.map((doc) => (
                    <li key={doc.id} className="flex justify-between gap-3">
                      <span className="break-all text-ink">{doc.filename}</span>
                      <span className="shrink-0 text-xs text-bad">{doc.status === "needs_ocr" ? "No readable text" : "Could not be read"}</span>
                    </li>
                  ))}
                  {!report.analysis && <li className="text-xs text-mute">Analyze the documents to list them here.</li>}
                </ul>
              </div>
            </Disclosure>

            <Disclosure title="Requirement list and sources">
              <p className="text-sm font-medium text-ink">{report.set.name}</p>
              <div className="mt-1">
                <SourceLabel kind={report.set.verification === "official_text" ? "official" : "synthetic"} />
              </div>
              <p className="mt-2 text-xs leading-relaxed text-ink-soft">{report.set.verificationNote}</p>
              {report.set.sourceUrl && (
                <a href={report.set.sourceUrl} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs text-teal-dark underline">
                  {report.set.sourceName} ↗
                </a>
              )}
              {report.applicability && <p className="mt-2 text-xs text-ink-soft">Scope check: {report.applicability.reason}</p>}
            </Disclosure>

            <Disclosure title="How this report was produced">
              <div className="space-y-2 text-sm text-ink-soft">
                <p>Text is extracted from each PDF page by page. An AI model proposes facts, differences and evidence matches.</p>
                <p>
                  Code then checks that every quotation appears in the document text, limits each evidence status to what the verified quotes support,
                  and compares identifiers, names, specifications, revisions and validity dates exactly.
                </p>
                <p>“Not found” means the evidence was not found in the uploaded text. It is shown as missing only when a reviewer confirms it.</p>
                <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1">
                  <SourceLabel kind="official" />
                  <SourceLabel kind="synthetic" />
                  <SourceLabel kind="ai" />
                  <SourceLabel kind="demo-seed" />
                  <SourceLabel kind="code" />
                  <SourceLabel kind="human" />
                </div>
                <p className="text-xs text-mute">
                  Evidence: {report.mapping ? (report.mapping.source === "demo-seed" ? "demo data" : `${report.mapping.model}, ${new Date(report.mapping.createdAt).toLocaleString()}`) : "not matched"} ·
                  Consistency: {report.analysis ? (report.analysis.source === "demo-seed" ? "demo data" : `${report.analysis.model}, ${new Date(report.analysis.createdAt).toLocaleString()}`) : "not analyzed"}
                </p>
              </div>
            </Disclosure>

            <Disclosure title="Review history" count={reviewHistory.length}>
              {reviewHistory.length === 0 ? (
                <p className="text-sm text-mute">No reviews recorded yet.</p>
              ) : (
                <ul className="divide-y divide-line text-sm">
                  {reviewHistory.map(({ key, r, title }) => (
                    <li key={key} className="py-2">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <span className="text-ink">{title}</span>
                        <span className="text-xs text-mute">{new Date(r.updatedAt).toLocaleString()}</span>
                      </div>
                      <div className="text-xs text-ink-soft">
                        {r.dismissedReason ? `Dismissed: ${r.dismissedReason}` : [r.reviewed && "Reviewed", r.decision !== "undecided" && r.decision, r.status && `status set to ${r.status}`].filter(Boolean).join(" · ") || "Updated"}
                        {r.note && ` · Note: ${r.note}`}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <button
                type="button"
                className="no-print mt-3 text-xs text-bad underline"
                onClick={() => {
                  if (window.confirm("Clear all reviews, notes and dismissals for this workspace?")) reviewActions.clearWorkspace(state.workspaceId);
                }}
              >
                Clear all reviews for this workspace
              </button>
              <p className="mt-2 text-xs text-mute">Reviews are saved in this browser and kept when the AI is re-run.</p>
            </Disclosure>
          </section>
        </>
      )}

      <Drawer
        open={Boolean(openReq || openFinding)}
        onClose={() => setQueryParam("item", null)}
        eyebrow={openReq ? <span className="font-mono">{openReq.requirement.id}</span> : openFinding?.kindLabel}
        title={openReq?.requirement.title ?? openFinding?.title ?? ""}
      >
        {openReq && <RequirementDetail r={openReq} applicable={report.applicability ? report.applicability.applicable : null} />}
        {openFinding && <FindingDetail f={openFinding} />}
      </Drawer>
    </article>
  );
}
