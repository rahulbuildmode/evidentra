"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  CATEGORY_LABEL,
  FACT_CATEGORIES,
  type AnalysisItem,
  type AnalysisResult,
  type CheckedCitation,
  type Uncertainty,
} from "@/lib/analysis";
import { checkVerifiedAiFacts } from "@/lib/checks";
import { actions, useAppState } from "@/lib/store";
import type { Fact } from "@/lib/types";
import { Badge, Button, Card } from "./ui";

const UNCERTAINTY_TONE: Record<Uncertainty, "teal" | "warn" | "bad"> = { low: "teal", medium: "warn", high: "bad" };

function CitationView({ c }: { c: CheckedCitation }) {
  const badge =
    c.check === "verified" ? (
      <Badge tone="teal">Quote verified · p.{c.verifiedPage}</Badge>
    ) : c.check === "verified_other_page" ? (
      <Badge tone="warn">
        Quote found on p.{c.verifiedPage} (AI said p.{c.claimedPage ?? "?"})
      </Badge>
    ) : c.check === "unknown_file" ? (
      <Badge tone="bad">Cited file is not one of your uploads</Badge>
    ) : (
      <Badge tone="bad">Quote NOT found in the text — do not rely on it</Badge>
    );
  return (
    <div className="border-l-2 border-line pl-2">
      <div className="italic text-ink-soft">&ldquo;{c.quote}&rdquo;</div>
      <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-mute">
        <span className="break-all">{c.filename}</span>
        {badge}
      </div>
    </div>
  );
}

function Review({ id }: { id: string }) {
  const { decisions } = useAppState();
  const key = `ai:${id}`;
  const d = decisions[key] ?? "undecided";
  return (
    <div className="flex flex-col gap-1">
      <div className="flex gap-1">
        <Button
          variant={d === "approved" ? "primary" : "secondary"}
          aria-pressed={d === "approved"}
          onClick={() => actions.setDecision(key, d === "approved" ? "undecided" : "approved")}
        >
          Accept
        </Button>
        <Button
          variant={d === "rejected" ? "danger" : "secondary"}
          aria-pressed={d === "rejected"}
          onClick={() => actions.setDecision(key, d === "rejected" ? "undecided" : "rejected")}
        >
          Reject
        </Button>
      </div>
      <span className="text-xs text-mute">
        {d === "approved" ? "Accepted by you" : d === "rejected" ? "Rejected by you" : "Needs review"}
      </span>
    </div>
  );
}

function ItemsTable({ items, valueLabel }: { items: AnalysisItem[]; valueLabel: string }) {
  if (items.length === 0) return <p className="text-sm text-mute">None reported.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[820px] text-left text-sm">
        <thead>
          <tr className="border-b border-line text-xs uppercase tracking-wide text-mute">
            <th className="w-44 py-2 pr-3 font-medium">Field / finding</th>
            <th className="py-2 pr-3 font-medium">{valueLabel}</th>
            <th className="py-2 pr-3 font-medium">Source and quotation</th>
            <th className="w-24 py-2 pr-3 font-medium">Uncertainty</th>
            <th className="w-40 py-2 font-medium">Review</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it) => (
            <tr key={it.id} className="border-b border-line/60 align-top last:border-0">
              <td className="py-3 pr-3">
                <div className="font-medium text-ink">{it.field}</div>
                {it.kind === "fact" && (
                  <div className="text-xs text-mute">{CATEGORY_LABEL[it.category as keyof typeof CATEGORY_LABEL]}</div>
                )}
              </td>
              <td className="py-3 pr-3 text-ink">{it.value}</td>
              <td className="space-y-2 py-3 pr-3">
                {it.citations.length > 0 ? (
                  it.citations.map((c, i) => <CitationView key={i} c={c} />)
                ) : (
                  <span className="text-xs text-mute">No quotation: an absence cannot be quoted. Check manually.</span>
                )}
              </td>
              <td className="py-3 pr-3">
                <Badge tone={UNCERTAINTY_TONE[it.uncertainty]}>{it.uncertainty}</Badge>
                <div className="mt-1 text-xs text-mute">AI confidence: {it.modelConfidence}</div>
              </td>
              <td className="py-3">
                <Review id={it.id} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Turn quote-verified AI facts into the shape the deterministic checks use. */
function verifiedFacts(result: AnalysisResult): Fact[] {
  const out: Fact[] = [];
  for (const it of result.items) {
    const c = it.citations[0];
    if (it.kind !== "fact" || !c || c.verifiedPage === null) continue;
    const field = it.category === "model_number" ? "model_number" : it.category === "device_name" ? "device_name" : null;
    if (!field) continue;
    out.push({ id: it.id, documentId: c.filename, field, value: it.value, quote: c.quote, filename: c.filename, page: c.verifiedPage, source: "upload" });
  }
  return out;
}

export function AiAnalysisPanel() {
  const { workspaceId } = useAppState();
  const [loaded, setLoaded] = useState<{
    ws: string;
    aiConfigured: boolean;
    model: string;
    analysis: AnalysisResult | null;
  } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [running, setRunning] = useState<{ startedAt: number } | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [runError, setRunError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/analyze?workspaceId=${encodeURIComponent(workspaceId)}`)
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error ?? "Could not load AI analysis status.");
        if (!cancelled) {
          setLoaded({ ws: workspaceId, ...j });
          setLoadError(null);
        }
      })
      .catch((e: Error) => !cancelled && setLoadError(e.message));
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setElapsed(Math.round((Date.now() - running.startedAt) / 1000)), 500);
    return () => clearInterval(t);
  }, [running]);

  async function run() {
    setRunError(null);
    setElapsed(0);
    setRunning({ startedAt: Date.now() });
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ workspaceId }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error ?? `Analysis failed (HTTP ${res.status}).`);
      setLoaded((l) => (l ? { ...l, analysis: j.analysis } : l));
    } catch (e) {
      setRunError(
        e instanceof TypeError
          ? "Could not reach the app server. Check that it is running and try again."
          : (e as Error).message,
      );
    } finally {
      setRunning(null);
    }
  }

  const current = loaded?.ws === workspaceId ? loaded : null;
  const result = current?.analysis ?? null;
  const facts = result?.items.filter((i) => i.kind === "fact") ?? [];
  facts.sort((a, b) => FACT_CATEGORIES.indexOf(a.category as never) - FACT_CATEGORIES.indexOf(b.category as never));
  const inconsistencies = result?.items.filter((i) => i.kind === "inconsistency") ?? [];
  const missing = result?.items.filter((i) => i.kind === "missing") ?? [];
  const unverified = result?.items.filter((i) => i.citations.some((c) => c.verifiedPage === null)).length ?? 0;
  const codeFindings = result ? checkVerifiedAiFacts(verifiedFacts(result)) : [];

  return (
    <section id="ai" className="mb-10 scroll-mt-6">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-ink">AI analysis of your uploads</h2>
            <p className="mt-1 max-w-2xl text-sm text-ink-soft">
              Gemini reads the extracted text of your uploaded PDFs and proposes facts, inconsistencies and missing
              information. Code then checks every quotation against the real text. Nothing here is a regulatory
              conclusion: you accept or reject each item.
            </p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <Button variant="primary" onClick={run} disabled={!current?.aiConfigured || running !== null}>
              {running ? `Analysing… ${elapsed}s` : result ? "Re-run AI analysis" : "Run AI analysis"}
            </Button>
            {current && <span className="text-xs text-mute">Model: {current.model}</span>}
          </div>
        </div>

        {loadError && <p className="mt-3 text-sm text-bad">{loadError}</p>}
        {current && !current.aiConfigured && (
          <p className="mt-3 rounded-md bg-warn-soft px-3 py-2 text-sm text-warn">
            AI analysis is unavailable: no GEMINI_API_KEY is configured on the server. Add it to .env.local and restart.
          </p>
        )}
        {running && (
          <p className="mt-3 text-sm text-ink-soft">
            Sending extracted text to Gemini and verifying quotations. This usually takes 10–60 seconds.
          </p>
        )}
        {runError && (
          <div role="alert" className="mt-3 rounded-md border border-bad/30 bg-bad-soft px-3 py-2 text-sm text-bad">
            {runError} {result ? "Your previous results below are unchanged." : "No results were produced."}{" "}
            <button type="button" className="underline" onClick={run}>
              Try again
            </button>
          </div>
        )}
        {current && !result && !running && !runError && (
          <p className="mt-3 text-sm text-mute">
            No AI analysis yet for this workspace. Upload readable PDFs on the{" "}
            <Link href="/documents" className="text-teal underline">
              Documents
            </Link>{" "}
            page, then run the analysis.
          </p>
        )}
        {result && (
          <div className="mt-4 rounded-md bg-background px-3 py-2 text-xs text-ink-soft">
            Last run {new Date(result.createdAt).toLocaleString()} · {result.documents.length} document(s) analysed
            {result.documents.some((d) => d.truncated) && " (some text was cut to stay within the input limit)"}
            {result.skipped.length > 0 &&
              ` · skipped: ${result.skipped.map((s) => `${s.filename} (${s.reason})`).join(", ")}`}
            {result.usage.promptTokens !== null &&
              ` · ${result.usage.promptTokens} input / ${result.usage.outputTokens} output tokens`}
            {unverified > 0 && (
              <span className="ml-1 font-medium text-bad">· {unverified} item(s) have unverified quotations</span>
            )}
          </div>
        )}
      </Card>

      {result && (
        <div className="mt-4 space-y-4">
          <Card title={`Extracted facts (${facts.length})`}>
            <ItemsTable items={facts} valueLabel="Extracted value" />
          </Card>
          <Card title={`Potential inconsistencies (${inconsistencies.length})`}>
            <ItemsTable items={inconsistencies} valueLabel="Explanation" />
          </Card>
          <Card title={`Potential missing information (${missing.length})`}>
            <p className="mb-3 text-xs text-mute">
              &quot;Not found in the uploaded documents&quot; does not mean the information does not exist elsewhere.
            </p>
            <ItemsTable items={missing} valueLabel="Explanation" />
          </Card>
          <Card title="Code cross-check of verified AI facts">
            <p className="mb-3 text-xs text-mute">
              Deterministic comparison of model numbers and device names whose quotations were verified. No AI is used
              in this step.
            </p>
            {codeFindings.length === 0 ? (
              <p className="text-sm text-ink-soft">No conflicts found among verified model numbers and device names.</p>
            ) : (
              <ul className="space-y-3">
                {codeFindings.map((f) => (
                  <li key={f.id} className="text-sm">
                    <Badge tone={f.severity === "fail" ? "bad" : "neutral"}>{f.severity === "fail" ? "Needs attention" : "Note"}</Badge>{" "}
                    <span className="font-medium text-ink">{f.title}.</span> <span className="text-ink-soft">{f.detail}</span>
                    <ul className="mt-1 space-y-1">
                      {f.citations.map((c, i) => (
                        <li key={i} className="border-l-2 border-teal pl-2 text-xs text-mute">
                          &ldquo;{c.quote}&rdquo; — {c.filename}, p.{c.page}
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}
    </section>
  );
}
