"use client";

import Link from "next/link";
import { useState } from "react";
import type { AnalysisItem, CheckedCitation } from "@/lib/analysis";
import { categoryLabel } from "@/lib/analysis";
import { aiItemBasis, DISPLAY_LABEL, type DisplayStatus, type Provenance, type ReportCitation, type ReportFinding, type RequirementRow } from "@/lib/report";
import { aiItemKey, FINDING_STATUS_LABEL, type Review } from "@/lib/review";
import { ReviewPanel, reviewStateOf } from "./ReviewPanel";
import { Badge, Button, DetailSection, Notice, StatusDot, type Tone } from "./ui";

export const DISPLAY_TONE: Record<DisplayStatus, Tone> = {
  found: "teal",
  partial: "warn",
  not_found: "warn",
  missing_confirmed: "bad",
  conflicting: "bad",
  needs_review: "neutral",
  not_assessed: "neutral",
};

export const SEVERITY: Record<ReportFinding["severity"], { label: string; tone: Tone }> = {
  high: { label: "High priority", tone: "bad" },
  medium: { label: "Medium priority", tone: "warn" },
  low: { label: "Low priority", tone: "neutral" },
};

/** Where an item came from, as quiet text (not a pill). */
const SOURCE_TEXT: Record<Provenance | "human", { text: string; mark: string; cls: string }> = {
  official: { text: "Official requirement", mark: "◆", cls: "text-teal-dark" },
  synthetic: { text: "Demo checklist item", mark: "◇", cls: "text-demo" },
  ai: { text: "AI suggestion", mark: "✦", cls: "text-ink-soft" },
  "demo-seed": { text: "Demo data", mark: "◇", cls: "text-demo" },
  code: { text: "Automatically checked", mark: "✓", cls: "text-ink-soft" },
  human: { text: "Reviewed by you", mark: "●", cls: "text-teal-dark" },
};

export function SourceLabel({ kind }: { kind: Provenance | "human" }) {
  const s = SOURCE_TEXT[kind];
  return (
    <span className={`inline-flex items-center gap-1 text-xs ${s.cls}`}>
      <span aria-hidden>{s.mark}</span>
      {s.text}
    </span>
  );
}

export function ReviewState({ review, basis }: { review: Review | undefined; basis?: string }) {
  const s = reviewStateOf(review, basis);
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5 whitespace-nowrap">
      <StatusDot tone={s.tone}>{s.label}</StatusDot>
      {s.changed && <span className="text-xs text-warn">· changed</span>}
    </span>
  );
}

const docHref = (filename: string, page: number | null) =>
  `/documents?view=${encodeURIComponent(filename)}${page ? `&page=${page}` : ""}`;

/** Quotations with file, page, verification result and a link to open the document text. */
export function CitationList({ citations, empty = "No supporting passage was cited." }: { citations: ReportCitation[]; empty?: string }) {
  if (citations.length === 0) return <p className="text-sm text-ink-soft">{empty}</p>;
  return (
    <ul className="space-y-3">
      {citations.map((c, i) => (
        <li key={i} className="rounded-lg border border-line bg-background/60 px-3 py-2">
          {c.value && <div className="mb-1 font-mono text-xs text-ink">{c.value}</div>}
          <blockquote className="text-sm italic text-ink">&ldquo;{c.quote}&rdquo;</blockquote>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-soft">
            <span className="break-all">{c.filename}</span>
            <span>page {c.page ?? "?"}</span>
            {c.verified ? (
              <span className="text-teal-dark">✓ Quote found in document text</span>
            ) : (
              <span className="font-medium text-bad">✕ Quote not found in document text — do not rely on it</span>
            )}
            <Link href={docHref(c.filename, c.page)} className="text-teal-dark underline-offset-2 hover:underline">
              Open document
            </Link>
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Convert raw AI citations (with the code's check) into report citations. */
export const toReportCitations = (cs: CheckedCitation[]): ReportCitation[] =>
  cs.map((c) => ({ filename: c.filename, page: c.verifiedPage ?? c.claimedPage, quote: c.quote, verified: c.verifiedPage !== null }));

/** Drawer body for one requirement. */
export function RequirementDetail({ r, applicable }: { r: RequirementRow; applicable: boolean | null }) {
  return (
    <>
      <DetailSection label="Requirement">
        <p>{r.requirement.description}</p>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
          <SourceLabel kind={r.requirementProvenance} />
          {r.requirementProvenance === "official" && <span className="text-xs text-mute">{r.requirement.sourceLocation}</span>}
        </div>
        {r.requirement.officialExcerpt && (
          <p className="mt-2 border-l-2 border-teal pl-2 text-xs italic text-ink-soft">Rule text: &ldquo;{r.requirement.officialExcerpt}&rdquo;</p>
        )}
        {r.requirementProvenance === "official" && applicable === false && (
          <p className="mt-2 text-xs text-warn">We need to confirm whether this requirement applies to this device and pathway.</p>
        )}
        {r.requirementProvenance === "synthetic" && <p className="mt-2 text-xs text-demo">Fictional demo item — not a regulatory requirement.</p>}
      </DetailSection>

      <DetailSection label="Expected evidence">{r.requirement.expectedEvidence}</DetailSection>

      <DetailSection label="Evidence status">
        <StatusDot tone={DISPLAY_TONE[r.display]} strong>
          {DISPLAY_LABEL[r.display]}
        </StatusDot>
        <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-mute">
          {r.evidenceProvenance && <SourceLabel kind={r.evidenceProvenance} />}
          {r.overridden && <SourceLabel kind="human" />}
          {r.overridden && r.proposedStatus && <span>Originally suggested: {DISPLAY_LABEL[r.proposedStatus === "missing" ? "not_found" : r.proposedStatus]}</span>}
        </div>
        {r.display === "not_found" && (
          <p className="mt-2 text-xs text-ink-soft">
            We couldn&apos;t find this in the uploaded text. That is not proof it doesn&apos;t exist — accept the suggestion below only if
            you confirm it is missing.
          </p>
        )}
      </DetailSection>

      <DetailSection label="Supporting passage">
        <CitationList citations={r.citations} />
      </DetailSection>

      {(r.rationale || r.codeNote) && (
        <DetailSection label="Why the evidence may or may not be sufficient">
          {r.rationale && <p>{r.rationale}</p>}
          {r.codeNote && <p className="mt-1 text-xs text-mute">{r.codeNote}</p>}
        </DetailSection>
      )}

      {r.nextAction && <DetailSection label="Recommended next step">{r.nextAction}</DetailSection>}

      <DetailSection label="Your review">
        <ReviewPanel itemKey={r.key} basis={r.basis} kind="requirement" aiSuggestion={r.evidenceProvenance === "ai"} />
      </DetailSection>
    </>
  );
}

/** Drawer body for one discrepancy or possible gap. */
export function FindingDetail({ f }: { f: ReportFinding }) {
  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <StatusDot tone={SEVERITY[f.severity].tone} strong>
          {SEVERITY[f.severity].label}
        </StatusDot>
        <SourceLabel kind={f.provenance} />
        {f.effectiveStatus !== "open" && <Badge tone="teal">{FINDING_STATUS_LABEL[f.effectiveStatus]}</Badge>}
      </div>
      <DetailSection label="What we found">
        <p>{f.detail}</p>
        <p className="mt-1 text-xs text-mute">{f.kindLabel}</p>
      </DetailSection>
      <DetailSection label="Why it matters">{f.whyItMatters}</DetailSection>
      <DetailSection label="Where it appears">
        <CitationList citations={f.citations} empty="This is about something that could not be found, so there is no passage to quote." />
      </DetailSection>
      <DetailSection label="Suggested next step">{f.nextStep}</DetailSection>
      <DetailSection label="Your review">
        <ReviewPanel itemKey={f.key} basis={f.basis} kind="finding" aiSuggestion={f.provenance !== "code"} />
      </DetailSection>
    </>
  );
}

/** Drawer body for one extracted fact. */
export function FactDetail({ it, demo }: { it: AnalysisItem; demo: boolean }) {
  return (
    <>
      <DetailSection label="Extracted value">
        <p className="font-medium">{it.value}</p>
        <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-mute">
          <span>{categoryLabel(it.category)}</span>
          <SourceLabel kind={demo ? "demo-seed" : "ai"} />
          <span>Uncertainty: {it.uncertainty}</span>
        </div>
      </DetailSection>
      <DetailSection label="Where it appears">
        <CitationList citations={toReportCitations(it.citations)} />
      </DetailSection>
      <DetailSection label="Your review">
        <ReviewPanel itemKey={aiItemKey(it)} basis={aiItemBasis(it)} kind="fact" aiSuggestion />
      </DetailSection>
    </>
  );
}

/** Reloads the fictional demo dossier on the server (real PDFs + verified seed). */
export function LoadDemoButton({ onLoaded, label = "Load demo dossier" }: { onLoaded: () => void; label?: string }) {
  const [state, setState] = useState<{ busy: boolean; error: string | null }>({ busy: false, error: null });
  async function load() {
    setState({ busy: true, error: null });
    try {
      const res = await fetch("/api/demo/load", { method: "POST" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error ?? "The demo dossier could not be loaded.");
      setState({ busy: false, error: null });
      onLoaded();
    } catch (e) {
      setState({ busy: false, error: (e as Error).message });
    }
  }
  return (
    <span className="inline-flex flex-col gap-1">
      <Button variant="primary" onClick={load} disabled={state.busy}>
        {state.busy ? "Loading demo…" : label}
      </Button>
      {state.error && (
        <Notice tone="bad" role="alert">
          {state.error}
        </Notice>
      )}
    </span>
  );
}
