"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { categoryLabel, FACT_CATEGORIES, type AnalysisItem, type AnalysisResult, type Uncertainty } from "@/lib/analysis";
import { aiItemBasis } from "@/lib/report";
import { aiItemKey } from "@/lib/review";
import { CitationView } from "./evidence";
import { ReviewPanel } from "./ReviewPanel";
import { Badge, Button, Card } from "./ui";

const UNCERTAINTY_TONE: Record<Uncertainty, "teal" | "warn" | "bad"> = { low: "teal", medium: "warn", high: "bad" };

/** Table of AI items (facts, semantic inconsistencies or missing info) with verification and review. */
export function ItemsTable({ items, valueLabel }: { items: AnalysisItem[]; valueLabel: string }) {
  if (items.length === 0) return <p className="text-sm text-mute">None reported.</p>;
  const sorted = [...items].sort(
    (a, b) => FACT_CATEGORIES.indexOf(a.category as never) - FACT_CATEGORIES.indexOf(b.category as never),
  );
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[820px] text-left text-sm">
        <thead>
          <tr className="border-b border-line text-xs uppercase tracking-wide text-mute">
            <th className="w-44 py-2 pr-3 font-medium">Field / finding</th>
            <th className="py-2 pr-3 font-medium">{valueLabel}</th>
            <th className="py-2 pr-3 font-medium">Source and quotation</th>
            <th className="w-24 py-2 pr-3 font-medium">Uncertainty</th>
            <th className="w-56 py-2 font-medium">Human review</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((it) => (
            <tr key={it.id} className="border-b border-line/60 align-top last:border-0">
              <td className="py-3 pr-3">
                <div className="font-medium text-ink">{it.field}</div>
                {it.kind === "fact" && <div className="text-xs text-mute">{categoryLabel(it.category)}</div>}
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
                <div className="mt-1 text-xs text-mute">Stated confidence: {it.modelConfidence}</div>
              </td>
              <td className="py-3">
                <ReviewPanel itemKey={aiItemKey(it)} basis={aiItemBasis(it)} kind={it.kind === "fact" ? "fact" : "finding"} aiSuggestion compact />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Run button, status and honest errors for the Gemini document analysis. */
export function AiRunCard({
  workspaceId,
  aiConfigured,
  model,
  analysis,
  onUpdated,
}: {
  workspaceId: string;
  aiConfigured: boolean;
  model: string;
  analysis: AnalysisResult | null;
  onUpdated: () => void;
}) {
  const [running, setRunning] = useState<{ startedAt: number } | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [runError, setRunError] = useState<string | null>(null);

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
      onUpdated();
    } catch (e) {
      setRunError(
        e instanceof TypeError ? "Could not reach the app server. Check that it is running and try again." : (e as Error).message,
      );
    } finally {
      setRunning(null);
    }
  }

  const unverified = analysis?.items.filter((i) => i.citations.some((c) => c.verifiedPage === null)).length ?? 0;

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-ink">AI document analysis</h2>
          <p className="mt-1 max-w-2xl text-sm text-ink-soft">
            Gemini reads the extracted text and proposes facts, semantic inconsistencies and missing information. Code
            then checks every quotation against the real text and runs the exact comparisons below. Nothing here is a
            regulatory conclusion.
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Button variant="primary" onClick={run} disabled={!aiConfigured || running !== null}>
            {running ? `Analysing… ${elapsed}s` : analysis?.source === "gemini" ? "Re-run AI analysis" : "Run AI analysis"}
          </Button>
          {model && <span className="text-xs text-mute">Model: {model}</span>}
        </div>
      </div>

      {!aiConfigured && (
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
          {runError} {analysis ? "Your previous results are unchanged." : "No results were produced."}{" "}
          <button type="button" className="underline" onClick={run}>
            Try again
          </button>
        </div>
      )}
      {!analysis && !running && !runError && (
        <p className="mt-3 text-sm text-mute">
          No analysis yet for this workspace. Upload readable PDFs on the{" "}
          <Link href="/documents" className="text-teal underline">
            Documents
          </Link>{" "}
          page, then run the analysis.
        </p>
      )}
      {analysis && (
        <div className="mt-4 rounded-md bg-background px-3 py-2 text-xs text-ink-soft">
          {analysis.source === "demo-seed" ? (
            <span className="font-medium text-demo">Demo seed — written by hand for the fictional dossier, not AI output. </span>
          ) : (
            <>Gemini run {new Date(analysis.createdAt).toLocaleString()} · </>
          )}
          {analysis.documents.length} document(s)
          {analysis.documents.some((d) => d.truncated) && " (some text was cut to stay within the input limit)"}
          {analysis.skipped.length > 0 &&
            ` · skipped: ${analysis.skipped.map((s) => `${s.filename} (${s.reason})`).join(", ")}`}
          {analysis.usage.promptTokens !== null &&
            ` · ${analysis.usage.promptTokens} input / ${analysis.usage.outputTokens} output tokens`}
          {unverified > 0 && <span className="ml-1 font-medium text-bad">· {unverified} item(s) have unverified quotations</span>}
        </div>
      )}
    </Card>
  );
}
