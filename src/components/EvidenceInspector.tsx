"use client";

import type { QuoteCheck } from "@/lib/analysis";
import { locateQuote } from "@/lib/highlight";
import { inspector, useInspectTarget, type QuoteTarget } from "@/lib/inspector-store";
import { VALIDATION_LABEL, VALIDATION_MEANING, type RequirementResult, type ValidationStatus } from "@/lib/regulatory/types";
import type { ReportFinding } from "@/lib/report";
import { useShared } from "@/lib/shared-fetch";
import { useGapReport } from "@/lib/use-report";
import { useUploads } from "@/lib/use-uploads";
import type { UploadedDocument } from "@/lib/uploads";
import { Drawer } from "./ui";

const MAX_PAGE_CHARS = 20_000;

export const CHECK_LABEL: Record<QuoteCheck, { text: string; cls: string }> = {
  verified: { text: "Verified on the cited page", cls: "text-teal-dark" },
  verified_other_page: { text: "Found on another page — page corrected by code", cls: "text-warn" },
  not_found: { text: "Not found in extracted text", cls: "text-bad" },
  unknown_file: { text: "Unknown file — not one of the uploaded documents", cls: "text-bad" },
};

function Label({ children, tone }: { children: string; tone: "ai" | "code" | "human" | "test" }) {
  const cls = {
    ai: "border-ultra/50 text-ultra",
    code: "border-teal/50 text-teal-dark",
    human: "border-warn/50 text-warn",
    test: "border-ink/30 text-ink",
  }[tone];
  return <span className={`inline-block rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] ${cls}`}>{children}</span>;
}

/** The actual extracted text of one page, with the quotation highlighted only where it really appears. */
function PageText({ workspaceId, filename, page, quote }: { workspaceId: string; filename: string; page: number | null; quote: string }) {
  const { uploads, loading } = useUploads(workspaceId);
  const meta = uploads.find((u) => u.filename === filename);
  const e = useShared(`doc:${workspaceId}:${meta?.id ?? "none"}`, async () => {
    if (!meta) return null;
    const res = await fetch(`/api/documents/${meta.id}?workspaceId=${encodeURIComponent(workspaceId)}`);
    const j = await res.json();
    if (!res.ok) throw new Error(j.error ?? "Could not load the text.");
    return j.document as UploadedDocument;
  });
  if (loading) return <p className="text-sm text-mute">Loading document list…</p>;
  if (!meta) return <p className="rounded-lg bg-bad-soft p-3 text-sm text-bad">The source document “{filename}” is not available in this workspace, so its text cannot be shown.</p>;
  if (e.error) return <p className="text-sm text-bad">{e.error}</p>;
  if (!e.data) return <p className="text-sm text-mute">Loading page text…</p>;
  if (page === null) return <p className="text-sm text-mute">No page could be resolved for this quotation.</p>;
  const p = e.data.pages.find((x) => x.page === page);
  if (!p) return <p className="text-sm text-bad">Page {page} does not exist in this document ({e.data.pages.length} pages).</p>;
  if (!p.text) return <p className="rounded-lg bg-warn-soft p-3 text-sm text-warn">No extractable text on this page — OCR may be required.</p>;
  const text = p.text.length > MAX_PAGE_CHARS ? p.text.slice(0, MAX_PAGE_CHARS) : p.text;
  const hit = locateQuote(text, quote);
  return (
    <div>
      <pre className="max-h-[50vh] overflow-auto whitespace-pre-wrap break-words rounded-lg bg-background p-3 font-mono text-xs leading-relaxed text-ink">
        {hit ? (
          <>
            {text.slice(0, hit[0])}
            <mark className="rounded bg-teal/25 px-0.5 text-ink ring-1 ring-teal">{text.slice(hit[0], hit[1])}</mark>
            {text.slice(hit[1])}
          </>
        ) : (
          text
        )}
      </pre>
      {p.text.length > MAX_PAGE_CHARS && <p className="mt-1 text-xs text-mute">Showing the first {MAX_PAGE_CHARS.toLocaleString()} characters of this page.</p>}
      <p className="mt-2 text-xs text-mute">
        {hit
          ? "Highlighted: the exact quotation as it appears in the extracted text."
          : "The exact quotation is not highlighted on this page. Code verification tolerates curly quotes, dashes, case and line-break hyphenation; nothing similar is highlighted as a match."}
      </p>
    </div>
  );
}

function QuoteEvidence({ q }: { q: QuoteTarget }) {
  const eligible = q.verifiedPage !== null;
  const showPage = q.verifiedPage ?? q.proposedPage;
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-line p-4">
          <Label tone={q.origin === "Verification test" ? "test" : q.origin === "Located by code" ? "code" : "ai"}>{q.origin === "AI proposal" ? "AI proposed" : q.origin}</Label>
          <blockquote className="mt-2 break-words text-sm italic text-ink">“{q.quote}”</blockquote>
          <dl className="mt-2 space-y-0.5 text-xs text-mute">
            <div>
              <dt className="inline">Document: </dt>
              <dd className="inline break-all text-ink">{q.proposedFilename}</dd>
            </div>
            <div>
              <dt className="inline">Page: </dt>
              <dd className="inline text-ink">{q.proposedPage ?? "not given"}</dd>
            </div>
            {q.context && (
              <div>
                <dt className="inline">For: </dt>
                <dd className="inline text-ink">{q.context}</dd>
              </div>
            )}
          </dl>
        </div>
        <div className="rounded-xl border border-line p-4">
          <Label tone="code">Code verified</Label>
          {q.check ? (
            <p className={`mt-2 text-sm font-semibold ${CHECK_LABEL[q.check].cls}`}>{CHECK_LABEL[q.check].text}</p>
          ) : (
            <p className="mt-2 text-sm text-mute">Not recorded</p>
          )}
          <dl className="mt-2 space-y-0.5 text-xs text-mute">
            <div>
              <dt className="inline">Matched page: </dt>
              <dd className="inline text-ink">{q.verifiedPage ?? "none"}</dd>
            </div>
            {q.check === "verified_other_page" && (
              <div className="text-warn">
                Proposed page {q.proposedPage ?? "—"} · actual page {q.verifiedPage}
              </div>
            )}
          </dl>
          <p className={`mt-2 text-xs ${eligible ? "text-teal-dark" : "text-bad"}`}>
            {eligible ? "Eligible to be shown as verified evidence." : "Not eligible as evidence — shown only as an unverified proposal."}
          </p>
        </div>
      </div>
      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-teal-dark">
          Extracted text{showPage ? ` · page ${showPage}` : ""}
          {q.check === "not_found" && showPage ? " (the proposed page, as comparison basis)" : ""}
        </h3>
        {q.check === "unknown_file" ? (
          <p className="rounded-lg bg-bad-soft p-3 text-sm text-bad">The proposed file name does not match any uploaded document, so there is no text to compare against.</p>
        ) : (
          <PageText workspaceId={q.workspaceId} filename={q.proposedFilename} page={showPage} quote={q.quote} />
        )}
      </section>
    </div>
  );
}

function FindingEvidence({ f, workspaceId }: { f: ReportFinding; workspaceId: string }) {
  const { report } = useGapReport();
  const isSeed = report.analysis?.source === "demo-seed";
  // The original proposal per quotation (claimed page + code check) from the saved analysis.
  const original = (filename: string, quote: string) =>
    report.analysis?.items.flatMap((i) => i.citations).find((c) => c.quote === quote && c.filename === filename) ?? null;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {f.provenance === "code" ? <Label tone="code">Deterministic check</Label> : <Label tone="ai">{isSeed ? "Demo seed" : "AI proposal"}</Label>}
        {f.humanReviewed ? <Label tone="human">Reviewed by you</Label> : <Label tone="human">Human review required</Label>}
      </div>
      <div>
        <p className="text-sm text-ink">{f.detail}</p>
        <p className="mt-1 text-xs text-mute">
          {f.provenance === "code"
            ? "Comparison result computed by code from quote-verified values."
            : isSeed
              ? "Hand-written demo finding (SYNTHETIC DEMO DATA). Its quotations are checked below by code."
              : "The model's interpretation. Its quotations are checked below; its meaning is not."}
          {f.changedSinceReview && " The evidence changed since your review."}
        </p>
      </div>
      {f.citations.map((c, i) => {
        const o = original(c.filename, c.quote);
        return (
          <QuoteEvidence
            key={i}
            q={{
              origin: f.provenance === "code" ? "AI proposal" : isSeed ? "Demo seed" : "AI proposal",
              context: c.value ? `Value: ${c.value}` : f.title,
              quote: c.quote,
              proposedFilename: c.filename,
              proposedPage: o ? o.claimedPage : c.page,
              check: o ? o.check : null,
              verifiedPage: o ? o.verifiedPage : c.verified ? c.page : null,
              workspaceId,
            }}
          />
        );
      })}
    </div>
  );
}

const STATUS_CLS: Record<ValidationStatus, string> = {
  evidence_found: "text-teal-dark",
  validated_against_source: "text-teal-dark",
  potential_gap: "text-warn",
  needs_human_review: "text-warn",
  conflict_detected: "text-bad",
  not_applicable: "text-mute",
};

/** One CDSCO requirement: official source, applicability (code), evidence (AI proposal vs code), status and rationale. */
function RequirementEvidence({ r, workspaceId, synthetic }: { r: RequirementResult; workspaceId: string; synthetic: boolean }) {
  return (
    <div className="space-y-6 text-sm">
      <div className="flex flex-wrap gap-2">
        <Label tone="code">{r.sourceVerified ? "Official source · verified" : "Source UNVERIFIED"}</Label>
        {r.humanReviewRequired && <Label tone="human">Human review required</Label>}
        {synthetic && <Label tone="test">Synthetic demo data</Label>}
      </div>
      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-teal-dark">Regulatory source</h3>
        <p className="mt-1 font-medium text-ink">{r.reference}</p>
        <blockquote className="mt-1 border-l-2 border-teal pl-3 italic text-ink">“{r.excerpt}”</blockquote>
        <a href={r.sourceUrl} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs text-teal-dark underline underline-offset-2">
          {r.sourceTitle} — PDF page {r.sourcePage} ↗
        </a>
        {r.checklist && (
          <p className="mt-2 text-xs text-ink">
            Also in the official CDSCO Form MD-7 checklist, item {r.checklist.item}: “{r.checklist.text}”{" "}
            <a href={r.checklist.url} target="_blank" rel="noreferrer" className="text-teal-dark underline underline-offset-2">
              checklist ↗
            </a>
          </p>
        )}
      </section>
      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-teal-dark">Applicability (decided by code)</h3>
        <p className="mt-1 text-ink">
          <strong>{r.applicability.decision === "applicable" ? "Applicable" : r.applicability.decision === "not_applicable" ? "Not applicable" : "Unresolved"}</strong> — {r.applicability.rationale}
        </p>
      </section>
      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-teal-dark">Result</h3>
        <p className={`mt-1 font-semibold ${STATUS_CLS[r.status]}`}>{VALIDATION_LABEL[r.status]}</p>
        <p className="mt-1 text-ink">{r.explanation}</p>
        <p className="mt-1 text-xs text-mute">{VALIDATION_MEANING[r.status]}</p>
        <p className="mt-2 text-xs text-mute">{r.searched}</p>
        <p className="mt-2 text-ink">
          <span className="text-mute">Next action: </span>
          {r.nextAction}
        </p>
      </section>
      {r.deterministic.length > 0 && (
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-teal-dark">Deterministic checks</h3>
          <ul className="mt-1 space-y-1">
            {r.deterministic.map((d, i) => (
              <li key={i}>
                <span className={d.outcome === "failed" ? "text-bad" : d.outcome === "passed" ? "text-teal-dark" : "text-mute"}>{d.outcome.replace("_", " ")}</span> · {d.check}
                <div className="text-xs text-mute">{d.detail}</div>
              </li>
            ))}
          </ul>
        </section>
      )}
      {r.ai && (
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-teal-dark">{r.ai.source === "demo-seed" ? "Demo seed proposal" : "AI proposal (Gemini)"}</h3>
          <p className="mt-1 text-ink">
            Proposed status: <strong>{r.ai.proposedStatus ?? "none"}</strong>
          </p>
          {r.ai.rationale && <p className="text-xs text-mute">{r.ai.rationale}</p>}
        </section>
      )}
      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-teal-dark">Evidence ({r.evidence.length})</h3>
        {r.evidence.length === 0 && <p className="mt-1 text-mute">No passages.</p>}
        <ul className="mt-2 space-y-2">
          {r.evidence.map((e, i) => (
            <li key={i}>
              <button
                type="button"
                className="w-full rounded-lg border border-line p-3 text-left hover:border-teal focus:outline-none focus-visible:ring-2 focus-visible:ring-teal"
                onClick={() =>
                  inspector.open({
                    kind: "quote",
                    quote: {
                      origin: e.kind === "ai_quote" ? (r.ai?.source === "demo-seed" ? "Demo seed" : "AI proposal") : "Located by code",
                      context: `${r.title} — ${e.kind === "ai_quote" ? "AI-proposed passage" : e.kind === "keyword" ? "keyword located by code" : "value compared by code"}`,
                      quote: e.text,
                      proposedFilename: e.filename,
                      proposedPage: e.kind === "ai_quote" ? (e.proposedPage ?? null) : e.page,
                      check: e.kind === "ai_quote" ? (e.check ?? null) : "verified",
                      verifiedPage: e.page,
                      workspaceId,
                    },
                  })
                }
              >
                <div className="text-[10px] uppercase tracking-[0.14em] text-mute">
                  {e.kind === "ai_quote" ? "AI-proposed quotation" : e.kind === "keyword" ? "Keyword located by code (relevance not assessed)" : "Value compared by code"}
                  {e.synthetic && " · synthetic demo document"}
                </div>
                <div className="break-words italic text-ink">“{e.text}”</div>
                <div className="text-xs text-mute">
                  {e.filename} · p.{e.page ?? "?"}
                  {e.check && <span className={` ${CHECK_LABEL[e.check].cls}`}> · {CHECK_LABEL[e.check].text}</span>}
                </div>
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

/** Side panel opened from findings, quotations and Engine Room records. */
export function EvidenceInspector() {
  const t = useInspectTarget();
  const title = !t ? "" : t.kind === "finding" ? t.finding.title : t.kind === "requirement" ? t.result.title : t.quote.context || "Quotation";
  return (
    <Drawer open={Boolean(t)} onClose={inspector.close} eyebrow="Evidence inspector" title={title}>
      {t?.kind === "quote" && <QuoteEvidence q={t.quote} />}
      {t?.kind === "finding" && <FindingEvidence f={t.finding} workspaceId={t.workspaceId} />}
      {t?.kind === "requirement" && <RequirementEvidence r={t.result} workspaceId={t.workspaceId} synthetic={t.synthetic} />}
    </Drawer>
  );
}
