"use client";

import { Badge, Button, Card, DemoNotice, PageHeader } from "@/components/ui";
import { runChecks } from "@/lib/checks";
import { evidenceMatrixCsv } from "@/lib/csv";
import { downloadCsv } from "@/lib/download";
import { REQUIREMENTS, REQUIREMENT_SET } from "@/lib/requirements";
import { useAppState, useToday } from "@/lib/store";
import { useUploads } from "@/lib/use-uploads";
import type { WorkspaceFieldKey } from "@/lib/types";

const LABELS: Record<WorkspaceFieldKey, string> = {
  deviceName: "Device name",
  manufacturer: "Manufacturer",
  modelNumber: "Model number",
  intendedUse: "Intended use",
  classification: "Classification",
  pathway: "Regulatory pathway",
};

export default function ReadinessReportPage() {
  const state = useAppState();
  const today = useToday();
  const { uploads } = useUploads(state.workspaceId);
  const findings = runChecks(state, today);
  const unverified = (Object.keys(LABELS) as WorkspaceFieldKey[]).filter((k) => !state.workspace[k].verified);
  const missing = state.evidence.filter((e) => e.suggestedStatus === "not_found");
  const approved = REQUIREMENTS.filter((r) => state.decisions[r.id] === "approved").length;
  const rejected = REQUIREMENTS.filter((r) => state.decisions[r.id] === "rejected").length;
  const undecided = REQUIREMENTS.length - approved - rejected;
  const analysed = state.evidence.length > 0;

  return (
    <>
      <PageHeader
        title="Readiness Report"
        subtitle="A working summary for a human reviewer. It is not a compliance certificate and not a prediction of CDSCO's decision."
        actions={
          <>
            <Button onClick={() => downloadCsv("evidentra-readiness.csv", evidenceMatrixCsv(state))}>Export CSV</Button>
            <Button variant="primary" onClick={() => window.print()}>
              Print / save as PDF
            </Button>
          </>
        }
      />
      {state.isDemo && <DemoNotice />}

      <div className="mb-5 text-xs text-mute">
        Generated {today ?? "…"} · Requirement set {REQUIREMENT_SET.name} v{REQUIREMENT_SET.version} (unverified draft)
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Product">
          <dl className="space-y-2 text-sm">
            {(Object.keys(LABELS) as WorkspaceFieldKey[]).map((k) => (
              <div key={k} className="flex items-start justify-between gap-4">
                <dt className="text-mute">{LABELS[k]}</dt>
                <dd className="text-right text-ink">
                  {state.workspace[k].value || "—"}{" "}
                  {state.workspace[k].verified ? <Badge tone="teal">Verified</Badge> : <Badge tone="warn">Unverified</Badge>}
                </dd>
              </div>
            ))}
          </dl>
        </Card>

        <Card title="Summary">
          <ul className="space-y-2 text-sm text-ink-soft">
            <li>
              Documents listed: {state.documents.length + uploads.length} (
              {uploads.filter((u) => u.status === "needs_ocr" || u.status === "failed").length} uploads without usable text)
            </li>
            <li>Inconsistencies needing attention: {findings.filter((f) => f.severity === "fail").length}</li>
            <li>Warnings and notes: {findings.filter((f) => f.severity !== "fail").length}</li>
            <li>
              Requirement topics with no evidence found in the uploaded documents: {analysed ? missing.length : "not analysed"}
            </li>
            <li>
              Human review: {approved} approved, {rejected} rejected, {undecided} undecided
            </li>
            <li>Workspace fields still unverified: {unverified.length}</li>
          </ul>
        </Card>
      </div>

      <Card title="Open items for the human reviewer" className="mt-4">
        {findings.length === 0 && missing.length === 0 && unverified.length === 0 ? (
          <p className="text-sm text-ink-soft">Nothing flagged. A qualified person must still review the full submission.</p>
        ) : (
          <ul className="list-disc space-y-1 pl-5 text-sm text-ink-soft">
            {findings.map((f) => (
              <li key={f.id}>
                <strong className="text-ink">{f.title}.</strong> {f.detail}
              </li>
            ))}
            {missing.map((e) => {
              const r = REQUIREMENTS.find((x) => x.id === e.requirementId);
              return (
                <li key={e.requirementId}>
                  <strong className="text-ink">{r?.title}:</strong> not found in the uploaded documents (this does not prove
                  the document does not exist).
                </li>
              );
            })}
            {unverified.length > 0 && (
              <li>Unverified workspace fields: {unverified.map((k) => LABELS[k]).join(", ")}.</li>
            )}
          </ul>
        )}
      </Card>

      <p className="mt-4 text-xs leading-relaxed text-mute">
        Evidentra is a document-review aid. It does not provide legal advice, does not certify compliance with the Medical
        Devices Rules, 2017, and does not file anything with CDSCO. Requirement topics are an unverified draft taken from
        CDSCO&apos;s public FAQ.
      </p>
    </>
  );
}
