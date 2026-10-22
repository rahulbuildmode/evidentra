"use client";

import { Badge, Button, Card, DemoNotice, PageHeader } from "@/components/ui";
import { crossCheck } from "@/lib/checks";
import { evidenceMatrixCsv } from "@/lib/csv";
import { downloadCsv } from "@/lib/download";
import { EVIDENCE_LABEL, EVIDENCE_STATUS } from "@/lib/mapping";
import { getRequirementSet, scenarioApplicability, SYNTHETIC_DEMO_SET } from "@/lib/requirements";
import { useAppState, useToday } from "@/lib/store";
import { useResults } from "@/lib/use-results";
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
  const r = useResults(state.workspaceId);
  const set = getRequirementSet(state.requirementSetId) ?? SYNTHETIC_DEMO_SET;
  const applicability = scenarioApplicability(set, state.workspace);
  const mapping = r.mapping?.requirementSetId === set.id ? r.mapping : null;
  const findings = crossCheck(r.analysis, state.workspace, today);
  const unverified = (Object.keys(LABELS) as WorkspaceFieldKey[]).filter((k) => !state.workspace[k].verified);
  const decisionOf = (id: string) => state.decisions[`req:${set.id}:${id}`] ?? "undecided";
  const openRows = mapping?.rows.filter((x) => x.status !== "found") ?? [];
  const pendingFindings = findings.filter((f) => (state.decisions[`cc:${f.id}`] ?? "undecided") === "undecided");

  return (
    <>
      <PageHeader
        title="Readiness Report"
        subtitle="A working summary for a human reviewer. It is not a compliance certificate and not a prediction of CDSCO's decision."
        actions={
          <>
            <Button onClick={() => downloadCsv("evidentra-readiness.csv", evidenceMatrixCsv(set, mapping, state.decisions, state.isDemo))}>
              Export CSV
            </Button>
            <Button variant="primary" onClick={() => window.print()}>
              Print / save as PDF
            </Button>
          </>
        }
      />
      {state.isDemo && <DemoNotice>FICTIONAL DEMO DOSSIER — not a real device, company, certificate or submission.</DemoNotice>}

      <div className="mb-5 text-xs text-mute">
        Generated {today ?? "…"} · Requirement set: {set.name} ({set.verification === "official_text" ? "checked against official text" : "synthetic demo"})
        {applicability && !applicability.applicable && " · applicability to this workspace NOT verified"}
        {mapping && ` · evidence mapping: ${mapping.source === "demo-seed" ? "demo seed" : `Gemini, ${new Date(mapping.createdAt).toLocaleDateString()}`}`}
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
              Documents: {uploads.length} ({uploads.filter((u) => u.status !== "extracted").length} without usable text)
            </li>
            <li>
              Evidence status:{" "}
              {mapping
                ? EVIDENCE_STATUS.map((s) => `${mapping.rows.filter((x) => x.status === s).length} ${EVIDENCE_LABEL[s].split(" —")[0].toLowerCase()}`).join(", ")
                : "not assessed"}
            </li>
            <li>
              Human review of requirements: {set.requirements.filter((q) => decisionOf(q.id) === "approved").length} accepted,{" "}
              {set.requirements.filter((q) => decisionOf(q.id) === "rejected").length} rejected,{" "}
              {set.requirements.filter((q) => decisionOf(q.id) === "undecided").length} pending
            </li>
            <li>
              Exact-value discrepancies: {r.analysis ? findings.filter((f) => f.severity === "fail").length : "not analysed"} (
              {pendingFindings.length} not yet reviewed)
            </li>
            <li>Workspace fields still unverified: {unverified.length}</li>
          </ul>
        </Card>
      </div>

      <Card title="Open items for the human reviewer" className="mt-4">
        {openRows.length === 0 && findings.length === 0 && unverified.length === 0 ? (
          <p className="text-sm text-ink-soft">
            {mapping ? "Nothing flagged." : "No evidence mapping yet."} A qualified person must still review the full submission.
          </p>
        ) : (
          <ul className="list-disc space-y-1 pl-5 text-sm text-ink-soft">
            {openRows.map((row) => {
              const req = set.requirements.find((q) => q.id === row.requirementId);
              return (
                <li key={row.requirementId}>
                  <strong className="text-ink">
                    {row.requirementId} {req?.title}: {EVIDENCE_LABEL[row.status]}.
                  </strong>{" "}
                  Next: {row.nextAction}
                </li>
              );
            })}
            {findings.map((f) => (
              <li key={f.id}>
                <strong className="text-ink">{f.title}.</strong> {f.detail}
              </li>
            ))}
            {unverified.length > 0 && <li>Unverified workspace fields: {unverified.map((k) => LABELS[k]).join(", ")}.</li>}
          </ul>
        )}
      </Card>

      <p className="mt-4 text-xs leading-relaxed text-mute">
        Evidentra is a document-review aid. It does not provide legal advice, does not certify compliance with the Medical
        Devices Rules, 2017, and does not file anything with CDSCO. &quot;Missing&quot; means not found in the uploaded
        text, not proof that evidence does not exist. Discrepancies are documentation differences for a reviewer, not
        legal findings.
      </p>
    </>
  );
}
