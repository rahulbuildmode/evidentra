"use client";

import { useState } from "react";
import { CitationView, LoadDemoButton } from "@/components/evidence";
import { ReviewPanel } from "@/components/ReviewPanel";
import { PROVENANCE_LABEL } from "@/lib/report";
import { useGapReport } from "@/lib/use-report";
import { Badge, Button, Card, DemoNotice, PageHeader } from "@/components/ui";
import { evidenceMatrixCsv } from "@/lib/csv";
import { downloadCsv } from "@/lib/download";
import { EVIDENCE_LABEL, type EvidenceStatus } from "@/lib/mapping";
import { getRequirementSet, REQUIREMENT_SETS, scenarioApplicability, SYNTHETIC_DEMO_SET } from "@/lib/requirements";
import { actions, useAppState } from "@/lib/store";

const STATUS_TONE: Record<EvidenceStatus, "teal" | "warn" | "bad" | "neutral"> = {
  found: "teal",
  partial: "warn",
  missing: "bad",
  conflicting: "bad",
  needs_review: "neutral",
};

export default function EvidenceMatrixPage() {
  const state = useAppState();
  const { report, results: r } = useGapReport();
  const set = getRequirementSet(state.requirementSetId) ?? SYNTHETIC_DEMO_SET;
  const applicability = scenarioApplicability(set, state.workspace);
  const mapping = r.mapping && r.mapping.requirementSetId === set.id ? r.mapping : null;
  const otherSetMapping = r.mapping && r.mapping.requirementSetId !== set.id ? r.mapping : null;

  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);

  async function runMapping() {
    setRunning(true);
    setRunError(null);
    try {
      const res = await fetch("/api/requirements/map", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ workspaceId: state.workspaceId, requirementSetId: set.id }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error ?? `Mapping failed (HTTP ${res.status}).`);
      r.refresh();
    } catch (e) {
      setRunError(e instanceof TypeError ? "Could not reach the app server." : (e as Error).message);
    } finally {
      setRunning(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Evidence Matrix"
        subtitle="Each requirement against the evidence found in the uploaded documents. The AI proposes; code verifies every quotation and caps the status to what was verified; you review."
        actions={
          <>
            <Button onClick={() => downloadCsv("evidentra-evidence-matrix.csv", evidenceMatrixCsv(report))}>
              Export CSV
            </Button>
            <Button variant="primary" onClick={runMapping} disabled={running || !r.aiConfigured}>
              {running ? "Mapping with AI…" : "Map evidence with AI"}
            </Button>
          </>
        }
      />
      {state.isDemo && (
        <DemoNotice>
          FICTIONAL DEMO DOSSIER. {!r.mapping && !r.loading && <LoadDemoButton onLoaded={r.refresh} />}
        </DemoNotice>
      )}

      <Card className="mb-4">
        <div className="flex flex-wrap items-center gap-3">
          <label htmlFor="req-set" className="text-sm font-medium text-ink">
            Requirement set
          </label>
          <select
            id="req-set"
            value={set.id}
            onChange={(e) => actions.setRequirementSet(e.target.value)}
            className="rounded-md border border-line bg-white px-3 py-2 text-sm text-ink focus:border-teal focus:outline-none"
          >
            {REQUIREMENT_SETS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          {set.verification === "official_text" ? (
            <Badge tone="teal">Checked against official text</Badge>
          ) : (
            <Badge tone="demo">Synthetic demo — not regulatory</Badge>
          )}
        </div>
        <p className="mt-3 text-xs leading-relaxed text-ink-soft">
          {set.verificationNote}{" "}
          {set.sourceUrl && (
            <a href={set.sourceUrl} target="_blank" rel="noreferrer" className="text-teal underline">
              {set.sourceName} ↗
            </a>
          )}
        </p>
        {applicability && (
          <p
            className={`mt-2 rounded-md px-3 py-2 text-xs ${
              applicability.applicable ? "bg-teal-soft text-teal-dark" : "bg-warn-soft text-warn"
            }`}
          >
            {applicability.applicable
              ? `Applicability: matches the verified scenario. ${applicability.reason}`
              : `Applicability NOT verified for this workspace — rows are reference only. ${applicability.reason}`}
            {applicability.basedOnUnverifiedFields && " (Based on workspace fields you have not marked as verified.)"}
          </p>
        )}
      </Card>

      {r.error && <p className="mb-4 text-sm text-bad">{r.error}</p>}
      {!r.aiConfigured && !r.loading && (
        <p className="mb-4 rounded-md bg-warn-soft px-3 py-2 text-sm text-warn">
          AI mapping is unavailable: no GEMINI_API_KEY is configured on the server.
        </p>
      )}
      {runError && (
        <div role="alert" className="mb-4 rounded-md border border-bad/30 bg-bad-soft px-3 py-2 text-sm text-bad">
          {runError} Earlier results are unchanged.{" "}
          <button type="button" className="underline" onClick={runMapping}>
            Try again
          </button>
        </div>
      )}
      {r.loading ? (
        <p className="mb-3 text-sm text-mute">Loading saved evidence mapping…</p>
      ) : mapping ? (
        <p className="mb-3 text-xs text-mute">
          {mapping.source === "demo-seed" ? (
            <span className="font-medium text-demo">Demo seed — hand-written evidence for the fictional dossier, not AI output. </span>
          ) : (
            <>AI mapping ({mapping.model}) run {new Date(mapping.createdAt).toLocaleString()}. </>
          )}
          Documents: {mapping.documents.join(", ") || "none"}.
        </p>
      ) : (
        <p className="mb-3 rounded-md border border-line bg-white px-4 py-3 text-sm text-ink-soft">
          No evidence mapping for this requirement set yet{otherSetMapping ? " (the saved mapping is for a different set)" : ""}.
          Rows show &quot;Not assessed&quot;, which says nothing about whether evidence exists. Use &quot;Map evidence with AI&quot;.
        </p>
      )}

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1080px] text-left text-sm">
            <thead>
              <tr className="border-b border-line text-xs uppercase tracking-wide text-mute">
                <th className="w-56 py-2 pr-3 font-medium">Requirement</th>
                <th className="w-44 py-2 pr-3 font-medium">Expected evidence</th>
                <th className="w-40 py-2 pr-3 font-medium">Evidence status</th>
                <th className="py-2 pr-3 font-medium">Source document, page and quotation</th>
                <th className="w-48 py-2 pr-3 font-medium">Recommended next action</th>
                <th className="w-56 py-2 font-medium">Human review</th>
              </tr>
            </thead>
            <tbody>
              {set.requirements.map((req) => {
                const row = mapping?.rows.find((x) => x.requirementId === req.id);
                const rep = report.requirements.find((x) => x.requirement.id === req.id)!;
                return (
                  <tr key={req.id} className="border-b border-line/60 align-top last:border-0">
                    <td className="py-3 pr-3">
                      <div className="font-mono text-xs text-mute">{req.id}</div>
                      <div className="font-medium text-ink">{req.title}</div>
                      <div className="mt-1 text-xs text-ink-soft">{req.description}</div>
                      <div className="mt-1 text-xs text-mute">{req.sourceLocation}</div>
                      {req.officialExcerpt && (
                        <div className="mt-1 text-xs italic text-mute">Rule text: &ldquo;{req.officialExcerpt}&rdquo;</div>
                      )}
                      <div className="mt-1">
                        {set.verification === "official_text" ? (
                          applicability?.applicable ? (
                            <Badge tone="teal">Verified text</Badge>
                          ) : (
                            <Badge tone="warn">Text verified; scenario not</Badge>
                          )
                        ) : (
                          <Badge tone="demo">Synthetic demo</Badge>
                        )}
                      </div>
                    </td>
                    <td className="py-3 pr-3 text-xs text-ink-soft">{req.expectedEvidence}</td>
                    <td className="py-3 pr-3">
                      {row ? (
                        <>
                          <Badge tone={STATUS_TONE[row.status]}>{EVIDENCE_LABEL[row.status]}</Badge>
                          <div className="mt-1 text-xs text-mute">
                            {rep.evidenceProvenance ? PROVENANCE_LABEL[rep.evidenceProvenance] : ""}
                          </div>
                          {rep.overridden && rep.effectiveStatus !== "not_assessed" && (
                            <div className="mt-1">
                              <Badge tone="teal">Human: {EVIDENCE_LABEL[rep.effectiveStatus]}</Badge>
                            </div>
                          )}
                          {row.proposedStatus && row.proposedStatus !== row.status && (
                            <div className="mt-1 text-xs text-warn">Proposed: {EVIDENCE_LABEL[row.proposedStatus]}</div>
                          )}
                          <div className="mt-1 text-xs text-ink-soft">{row.rationale}</div>
                          {row.codeNote && <div className="mt-1 text-xs text-mute">{row.codeNote}</div>}
                        </>
                      ) : (
                        <Badge>Not assessed</Badge>
                      )}
                    </td>
                    <td className="space-y-2 py-3 pr-3">
                      {row && row.citations.length > 0 ? (
                        row.citations.map((c, i) => <CitationView key={i} c={c} />)
                      ) : (
                        <span className="text-xs text-mute">No passage cited.</span>
                      )}
                    </td>
                    <td className="py-3 pr-3 text-xs text-ink-soft">{row?.nextAction ?? "—"}</td>
                    <td className="py-3">
                      <ReviewPanel itemKey={rep.key} basis={rep.basis} kind="requirement" aiSuggestion={rep.evidenceProvenance === "ai"} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
