"use client";

import type { ReactNode } from "react";
import { FindingList, LoadDemoButton } from "@/components/evidence";
import { ReviewPanel } from "@/components/ReviewPanel";
import { Badge, Button, Card, DemoNotice } from "@/components/ui";
import {
  actionListCsv,
  consistencyFindingsCsv,
  evidenceMatrixCsv,
} from "@/lib/csv";
import { downloadCsv } from "@/lib/download";
import { EVIDENCE_LABEL, type EvidenceStatus } from "@/lib/mapping";
import {
  PROVENANCE_LABEL,
  type ReportCitation,
  type RequirementRow,
} from "@/lib/report";
import { reviewActions } from "@/lib/review-store";
import type { WorkspaceFieldKey } from "@/lib/types";
import { STATUS_LABEL } from "@/lib/uploads";
import { useGapReport } from "@/lib/use-report";

const LABELS: Record<WorkspaceFieldKey, string> = {
  deviceName: "Device name",
  manufacturer: "Manufacturer",
  modelNumber: "Model number",
  intendedUse: "Intended use",
  classification: "Classification",
  pathway: "Regulatory pathway",
};

type Tone = "teal" | "warn" | "bad" | "neutral" | "demo";
const STATUS_TONE: Record<EvidenceStatus | "not_assessed", Tone> = {
  found: "teal",
  partial: "warn",
  missing: "bad",
  conflicting: "bad",
  needs_review: "neutral",
  not_assessed: "neutral",
};
const TILE: Record<Tone, string> = {
  teal: "border-teal/30 bg-teal-soft text-teal-dark",
  warn: "border-warn/30 bg-warn-soft text-warn",
  bad: "border-bad/30 bg-bad-soft text-bad",
  neutral: "border-line bg-white text-ink",
  demo: "border-demo/30 bg-demo-soft text-demo",
};
const PRIORITY: Record<1 | 2 | 3, { label: string; tone: Tone }> = {
  1: { label: "High", tone: "bad" },
  2: { label: "Medium", tone: "warn" },
  3: { label: "Low", tone: "neutral" },
};
const ORDER: EvidenceStatus[] = [
  "conflicting",
  "missing",
  "partial",
  "needs_review",
  "found",
];

function Section({
  n,
  title,
  children,
  hint,
}: {
  n: number;
  title: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <section className="mt-8 break-inside-avoid-page">
      <div className="mb-3 flex items-baseline gap-3 border-b border-line pb-2">
        <span className="font-mono text-xs text-teal">
          {String(n).padStart(2, "0")}
        </span>
        <h2 className="text-lg font-semibold tracking-tight text-ink">
          {title}
        </h2>
      </div>
      {hint && <p className="-mt-1 mb-3 text-xs text-mute">{hint}</p>}
      {children}
    </section>
  );
}

function Tile({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: number | string;
  tone?: Tone;
}) {
  return (
    <div className={`rounded-lg border px-4 py-3 ${TILE[tone]}`}>
      <div className="text-2xl font-semibold">{value}</div>
      <div className="text-xs opacity-90">{label}</div>
    </div>
  );
}

function Cites({ citations }: { citations: ReportCitation[] }) {
  if (citations.length === 0)
    return <p className="text-xs text-mute">No passage cited.</p>;
  return (
    <ul className="space-y-1">
      {citations.map((c, i) => (
        <li key={i} className="border-l-2 border-teal pl-2 text-xs">
          <span className="italic text-ink-soft">&ldquo;{c.quote}&rdquo;</span>{" "}
          <span className="text-mute">
            — {c.filename}, p.{c.page ?? "?"}
          </span>
          {!c.verified && (
            <span className="ml-1 font-medium text-bad">
              quotation not verified
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

function RequirementCard({ r }: { r: RequirementRow }) {
  return (
    <div
      className={`flex flex-col gap-4 rounded-lg border border-line bg-white p-4 md:flex-row ${r.dismissed ? "opacity-60" : ""}`}
    >
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs text-mute">
            {r.requirement.id}
          </span>
          <Badge
            tone={r.requirementProvenance === "official" ? "teal" : "demo"}
          >
            {PROVENANCE_LABEL[r.requirementProvenance]}
          </Badge>
          {r.evidenceProvenance && (
            <Badge
              tone={r.evidenceProvenance === "demo-seed" ? "demo" : "neutral"}
            >
              Evidence: {PROVENANCE_LABEL[r.evidenceProvenance]}
            </Badge>
          )}
          {r.overridden && <Badge tone="teal">Status set by reviewer</Badge>}
        </div>
        <div className="font-medium text-ink">{r.requirement.title}</div>
        <div className="text-xs text-mute">
          Expected: {r.requirement.expectedEvidence} ·{" "}
          {r.requirement.sourceLocation}
        </div>
        {r.rationale && <p className="text-sm text-ink-soft">{r.rationale}</p>}
        {r.overridden && r.proposedStatus && (
          <p className="text-xs text-mute">
            Proposed status was &ldquo;{EVIDENCE_LABEL[r.proposedStatus]}
            &rdquo;.
          </p>
        )}
        {r.codeNote && <p className="text-xs text-mute">{r.codeNote}</p>}
        <Cites citations={r.citations} />
        {r.nextAction && (
          <p className="text-sm">
            <span className="font-medium text-ink">Next action: </span>
            <span className="text-ink-soft">{r.nextAction}</span>
          </p>
        )}
      </div>
      <div className="shrink-0">
        <ReviewPanel
          itemKey={r.key}
          basis={r.basis}
          kind="requirement"
          aiSuggestion={r.evidenceProvenance === "ai"}
        />
      </div>
    </div>
  );
}

export default function GapReportPage() {
  const { state, report, loading, refresh } = useGapReport();
  const c = report.counts;
  const discrepancies = report.findings.filter(
    (f) => f.group === "discrepancy",
  );
  const missingInfo = report.findings.filter((f) => f.group === "missing_info");
  const assessed = report.requirements.some(
    (r) => r.effectiveStatus !== "not_assessed",
  );
  const allCitations = [
    ...report.requirements.flatMap((r) =>
      r.citations.map((x) => ({ ...x, usedBy: r.requirement.id })),
    ),
    ...report.findings.flatMap((f) =>
      f.citations.map((x) => ({ ...x, usedBy: f.title })),
    ),
  ];
  const citationIndex = [
    ...new Map(
      allCitations.map((x) => [`${x.filename}|${x.page}|${x.quote}`, x]),
    ).values(),
  ].sort(
    (a, b) =>
      a.filename.localeCompare(b.filename) || (a.page ?? 0) - (b.page ?? 0),
  );

  return (
    <article className="pb-16">
      <header className="rounded-xl border border-line bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-xs font-medium uppercase tracking-widest text-teal">
              Pre-submission documentation gap report
            </div>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink">
              {state.workspace.deviceName.value || "Untitled device"}
            </h1>
            <p className="mt-1 text-sm text-ink-soft">
              {state.workspace.manufacturer.value || "Manufacturer not set"} ·
              Model {state.workspace.modelNumber.value || "—"}
            </p>
            <p className="mt-2 text-xs text-mute">
              Generated {report.generatedFor || "…"} from the current workspace
              · Requirement set: {report.set.name}
              {report.mapping &&
                ` · Evidence: ${report.mapping.source === "demo-seed" ? "demo seed" : `Gemini (${new Date(report.mapping.createdAt).toLocaleDateString()})`}`}
              {report.analysis &&
                ` · Consistency: ${report.analysis.source === "demo-seed" ? "demo seed" : `Gemini (${new Date(report.analysis.createdAt).toLocaleDateString()})`}`}
            </p>
          </div>
          <div className="no-print flex flex-wrap gap-2">
            <Button
              onClick={() =>
                downloadCsv(
                  "evidentra-evidence-matrix.csv",
                  evidenceMatrixCsv(report),
                )
              }
            >
              Evidence CSV
            </Button>
            <Button
              onClick={() =>
                downloadCsv(
                  "evidentra-consistency-findings.csv",
                  consistencyFindingsCsv(report),
                )
              }
            >
              Findings CSV
            </Button>
            <Button
              onClick={() =>
                downloadCsv("evidentra-action-list.csv", actionListCsv(report))
              }
            >
              Actions CSV
            </Button>
            <Button variant="primary" onClick={() => window.print()}>
              Print / PDF
            </Button>
          </div>
        </div>
        <p className="mt-4 rounded-md bg-background px-3 py-2 text-xs leading-relaxed text-ink-soft">
          <strong className="text-ink">Not a compliance determination.</strong>{" "}
          This report lists documentation gaps and differences for a qualified
          reviewer. It does not certify compliance with the Medical Devices
          Rules, 2017, is not legal advice, and does not predict or guarantee
          CDSCO approval. &quot;Missing&quot; means not found in the uploaded
          text.
        </p>
      </header>

      {report.isDemo && (
        <div className="mt-4">
          <DemoNotice>
            FICTIONAL DEMO DOSSIER — not a real device, company, certificate or
            submission.{" "}
            {!loading && report.documents.total === 0 && (
              <LoadDemoButton onLoaded={refresh} />
            )}
          </DemoNotice>
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2 text-xs">
        <span className="text-mute">Key:</span>
        <Badge tone="teal">{PROVENANCE_LABEL.official}</Badge>
        <Badge tone="demo">{PROVENANCE_LABEL.synthetic}</Badge>
        <Badge>{PROVENANCE_LABEL.ai}</Badge>
        <Badge tone="demo">{PROVENANCE_LABEL["demo-seed"]}</Badge>
        <Badge>{PROVENANCE_LABEL.code}</Badge>
        <Badge tone="teal">Reviewed (human)</Badge>
      </div>

      {loading ? (
        <p className="mt-6 text-sm text-mute">Loading report data…</p>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {(
              [
                "found",
                "partial",
                "missing",
                "conflicting",
                "needs_review",
                "not_assessed",
              ] as const
            ).map((s) => (
              <Tile
                key={s}
                label={
                  s === "not_assessed"
                    ? "Not assessed"
                    : EVIDENCE_LABEL[s].split(" —")[0]
                }
                value={c.evidence[s]}
                tone={c.evidence[s] ? STATUS_TONE[s] : "neutral"}
              />
            ))}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <Tile
              label="Open discrepancies"
              value={c.discrepanciesOpen}
              tone={c.discrepanciesOpen ? "bad" : "neutral"}
            />
            <Tile
              label="Confirmed discrepancies"
              value={c.discrepanciesConfirmed}
              tone={c.discrepanciesConfirmed ? "warn" : "neutral"}
            />
            <Tile label="Resolved" value={c.discrepanciesResolved} />
            <Tile
              label="Awaiting human review"
              value={c.awaitingReview}
              tone={c.awaitingReview ? "warn" : "teal"}
            />
            <Tile label="Dismissed as false positive" value={c.dismissed} />
            <Tile
              label="Changed since review"
              value={c.changedSinceReview}
              tone={c.changedSinceReview ? "warn" : "neutral"}
            />
          </div>
        </>
      )}

      <Section n={1} title="Submission and device details">
        <div className="grid gap-4 lg:grid-cols-2">
          <Card title="Product (from workspace)">
            <dl className="space-y-2 text-sm">
              {(Object.keys(LABELS) as WorkspaceFieldKey[]).map((k) => (
                <div key={k} className="flex items-start justify-between gap-4">
                  <dt className="text-mute">{LABELS[k]}</dt>
                  <dd className="text-right text-ink">
                    {state.workspace[k].value || "—"}{" "}
                    {state.workspace[k].verified ? (
                      <Badge tone="teal">Verified</Badge>
                    ) : (
                      <Badge tone="warn">Unverified</Badge>
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          </Card>
          <Card
            title={`Documents (${report.documents.total}; ${report.documents.usable} with usable text)`}
          >
            {report.analysis?.documents.length || report.documents.total ? (
              <ul className="space-y-1 text-sm">
                {(report.analysis?.documents ?? []).map((d) => (
                  <li key={d.id} className="flex justify-between gap-3">
                    <span className="break-all text-ink">{d.filename}</span>
                    <span className="shrink-0 text-xs text-mute">
                      {d.pageCount} page(s)
                    </span>
                  </li>
                ))}
                {report.documents.unusable.map((d) => (
                  <li key={d.id} className="flex justify-between gap-3">
                    <span className="break-all text-ink">{d.filename}</span>
                    <Badge tone="bad">{STATUS_LABEL[d.status]}</Badge>
                  </li>
                ))}
                {!report.analysis && (
                  <li className="text-xs text-mute">
                    Run the AI analysis to list analysed documents.
                  </li>
                )}
              </ul>
            ) : (
              <p className="text-sm text-mute">No documents uploaded.</p>
            )}
          </Card>
        </div>
      </Section>

      <Section n={2} title="Regulatory scenario and verification status">
        <Card>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-ink">{report.set.name}</span>
            {report.set.verification === "official_text" ? (
              <Badge tone="teal">Official text checked</Badge>
            ) : (
              <Badge tone="demo">Synthetic demo — not regulatory</Badge>
            )}
          </div>
          <p className="mt-2 text-xs leading-relaxed text-ink-soft">
            {report.set.verificationNote}
          </p>
          {report.applicability && (
            <p
              className={`mt-3 rounded-md px-3 py-2 text-xs ${report.applicability.applicable ? "bg-teal-soft text-teal-dark" : "bg-warn-soft text-warn"}`}
            >
              {report.applicability.applicable
                ? "Scenario matches the verified scope. "
                : "Scenario NOT verified — requirements are reference only. "}
              {report.applicability.reason}
              {report.applicability.basedOnUnverifiedFields &&
                " Based on workspace fields not yet marked verified."}
            </p>
          )}
        </Card>
      </Section>

      <Section
        n={3}
        title="Evidence found, partial, missing and conflicting"
        hint="Grouped by current status (a reviewer's status replaces the proposed one). Dismissed items are faded."
      >
        {!assessed ? (
          <p className="rounded-md border border-line bg-white px-4 py-3 text-sm text-ink-soft">
            No evidence mapping for this requirement set yet. Run &quot;Map
            evidence with AI&quot; on the Evidence Matrix page. Nothing here
            means evidence is missing.
          </p>
        ) : (
          <div className="space-y-6">
            {ORDER.map((s) => {
              const rows = report.requirements.filter(
                (r) => r.effectiveStatus === s,
              );
              if (rows.length === 0) return null;
              return (
                <div key={s}>
                  <div className="mb-2 flex items-center gap-2">
                    <Badge tone={STATUS_TONE[s]}>{EVIDENCE_LABEL[s]}</Badge>
                    <span className="text-xs text-mute">
                      {rows.length} requirement(s)
                    </span>
                  </div>
                  <div className="space-y-3">
                    {rows.map((r) => (
                      <RequirementCard key={r.key} r={r} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {missingInfo.length > 0 && (
          <div className="mt-6">
            <div className="mb-2 flex items-center gap-2">
              <Badge>Possible missing information</Badge>
              <span className="text-xs text-mute">
                Suggested by{" "}
                {report.analysis?.source === "demo-seed"
                  ? "the demo seed"
                  : "AI"}
                ; not tied to a requirement
              </span>
            </div>
            <Card>
              <FindingList findings={missingInfo} empty="" />
            </Card>
          </div>
        )}
      </Section>

      <Section
        n={4}
        title="Unresolved applicability questions"
        hint="Questions a qualified person should settle before relying on this report."
      >
        {report.questions.length === 0 ? (
          <p className="text-sm text-ink-soft">None identified.</p>
        ) : (
          <ol className="list-decimal space-y-2 pl-5 text-sm">
            {report.questions.map((q) => (
              <li key={q.id}>
                <span className="font-medium text-ink">{q.question}</span>
                <div className="text-xs text-mute">{q.why}</div>
              </li>
            ))}
          </ol>
        )}
      </Section>

      <Section
        n={5}
        title="Cross-document discrepancies"
        hint="Code checks compare exact values; AI suggestions describe differences in meaning. A discrepancy is not a legal finding."
      >
        <Card>
          <FindingList
            findings={discrepancies}
            empty={
              report.analysis
                ? "No discrepancies found among the analysed documents."
                : "No consistency analysis yet."
            }
          />
        </Card>
      </Section>

      <Section
        n={6}
        title={`Findings awaiting human review (${report.awaitingReview.length})`}
      >
        {report.awaitingReview.length === 0 ? (
          <p className="text-sm text-ink-soft">
            Every assessed item has been reviewed or dismissed.
          </p>
        ) : (
          <ul className="grid gap-2 text-sm md:grid-cols-2">
            {report.awaitingReview.map((x) => (
              <li
                key={x.key}
                className="flex items-start justify-between gap-2 rounded-md border border-line bg-white px-3 py-2"
              >
                <span className="text-ink">
                  {"requirement" in x
                    ? `${x.requirement.id} ${x.requirement.title}`
                    : x.title}
                  <span className="block text-xs text-mute">
                    {"requirement" in x
                      ? `${x.effectiveStatus === "not_assessed" ? "Not assessed" : EVIDENCE_LABEL[x.effectiveStatus]} · ${x.evidenceProvenance ? PROVENANCE_LABEL[x.evidenceProvenance] : ""}`
                      : `${x.group === "discrepancy" ? "Discrepancy" : "Possible missing information"} · ${PROVENANCE_LABEL[x.provenance]}`}
                  </span>
                </span>
                {x.changedSinceReview && <Badge tone="warn">Changed</Badge>}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section
        n={7}
        title={`Prioritised recommended actions (${report.actions.length})`}
        hint="Ordered by priority. Dismissed and resolved items are left out."
      >
        {report.actions.length === 0 ? (
          <p className="text-sm text-ink-soft">No actions.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-line bg-white">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead>
                <tr className="border-b border-line text-xs uppercase tracking-wide text-mute">
                  <th className="w-20 px-3 py-2 font-medium">Priority</th>
                  <th className="px-3 py-2 font-medium">Action</th>
                  <th className="w-64 px-3 py-2 font-medium">
                    Supporting evidence
                  </th>
                  <th className="w-32 px-3 py-2 font-medium">Review state</th>
                </tr>
              </thead>
              <tbody>
                {report.actions.map((a) => (
                  <tr
                    key={a.id}
                    className="border-b border-line/60 align-top last:border-0"
                  >
                    <td className="px-3 py-3">
                      <Badge tone={PRIORITY[a.priority].tone}>
                        {PRIORITY[a.priority].label}
                      </Badge>
                    </td>
                    <td className="px-3 py-3">
                      <div className="font-medium text-ink">{a.title}</div>
                      <div className="text-ink-soft">{a.action}</div>
                      <div className="mt-1 text-xs text-mute">
                        {PROVENANCE_LABEL[a.provenance]}
                        {a.reason && ` · ${a.reason}`}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <Cites citations={a.citations.slice(0, 3)} />
                    </td>
                    <td className="px-3 py-3 text-xs capitalize text-ink-soft">
                      {a.reviewState}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section
        n={8}
        title={`Supporting files, pages and quotations (${citationIndex.length})`}
        hint="Every passage cited in this report. Unverified quotations were not found in the extracted text."
      >
        {citationIndex.length === 0 ? (
          <p className="text-sm text-mute">No passages cited.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-line bg-white">
            <table className="w-full min-w-[700px] text-left text-sm">
              <thead>
                <tr className="border-b border-line text-xs uppercase tracking-wide text-mute">
                  <th className="px-3 py-2 font-medium">File</th>
                  <th className="w-16 px-3 py-2 font-medium">Page</th>
                  <th className="px-3 py-2 font-medium">Quotation</th>
                  <th className="w-28 px-3 py-2 font-medium">Check</th>
                </tr>
              </thead>
              <tbody>
                {citationIndex.map((x, i) => (
                  <tr
                    key={i}
                    className="border-b border-line/60 align-top last:border-0"
                  >
                    <td className="break-all px-3 py-2 text-ink">
                      {x.filename}
                    </td>
                    <td className="px-3 py-2 text-ink-soft">{x.page ?? "?"}</td>
                    <td className="px-3 py-2 text-xs italic text-ink-soft">
                      &ldquo;{x.quote}&rdquo;
                    </td>
                    <td className="px-3 py-2">
                      {x.verified ? (
                        <Badge tone="teal">Verified</Badge>
                      ) : (
                        <Badge tone="bad">Not verified</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <div className="no-print mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4 text-xs text-mute">
        <span>
          Human reviews are saved in this browser for this workspace and are
          kept when the AI is re-run or the report is regenerated.
        </span>
        <button
          type="button"
          className="text-bad underline"
          onClick={() => {
            if (
              window.confirm(
                "Clear all human reviews, notes and dismissals for this workspace?",
              )
            )
              reviewActions.clearWorkspace(state.workspaceId);
          }}
        >
          Clear all reviews for this workspace
        </button>
      </div>
    </article>
  );
}
