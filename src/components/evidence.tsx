"use client";

import { useState } from "react";
import type { CheckedCitation } from "@/lib/analysis";
import { PROVENANCE_LABEL, type ReportFinding } from "@/lib/report";
import { FINDING_STATUS_LABEL } from "@/lib/review";
import { ReviewPanel } from "./ReviewPanel";
import { Badge, Button } from "./ui";

/** A quotation plus the code's verdict on whether it really appears in the extracted text. */
export function CitationView({ c }: { c: CheckedCitation }) {
  const badge =
    c.check === "verified" ? (
      <Badge tone="teal">Quote verified · p.{c.verifiedPage}</Badge>
    ) : c.check === "verified_other_page" ? (
      <Badge tone="warn">
        Quote found on p.{c.verifiedPage} (cited p.{c.claimedPage ?? "?"})
      </Badge>
    ) : c.check === "unknown_file" ? (
      <Badge tone="bad">Cited file is not one of the documents</Badge>
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

const SEVERITY_TONE = { high: "bad", medium: "warn", low: "neutral" } as const;
const SEVERITY_LABEL = { high: "High", medium: "Medium", low: "Low" } as const;

/** Discrepancy findings (code or AI) with conflicting values, sources, passages and human review. */
export function FindingList({ findings, empty }: { findings: ReportFinding[]; empty: string }) {
  if (findings.length === 0) return <p className="text-sm text-ink-soft">{empty}</p>;
  return (
    <ul className="space-y-4">
      {findings.map((f) => (
        <li
          key={f.key}
          className={`flex flex-col gap-3 border-b border-line/60 pb-4 last:border-0 last:pb-0 md:flex-row ${f.dismissed ? "opacity-60" : ""}`}
        >
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={SEVERITY_TONE[f.severity]}>{SEVERITY_LABEL[f.severity]}</Badge>
              <Badge tone={f.provenance === "code" ? "neutral" : f.provenance === "demo-seed" ? "demo" : "teal"}>
                {PROVENANCE_LABEL[f.provenance]}
              </Badge>
              {f.effectiveStatus !== "open" && <Badge tone="teal">{FINDING_STATUS_LABEL[f.effectiveStatus]}</Badge>}
            </div>
            <div className="mt-1 text-sm font-medium text-ink">{f.title}</div>
            <p className="text-sm text-ink-soft">{f.detail}</p>
            <ul className="mt-2 space-y-1">
              {f.citations.map((c, i) => (
                <li key={i} className="border-l-2 border-teal pl-2 text-sm">
                  {c.value && <span className="mr-2 font-mono text-xs text-ink">{c.value}</span>}
                  <span className="italic text-ink-soft">&ldquo;{c.quote}&rdquo;</span>
                  <div className="text-xs text-mute">
                    {c.filename}, page {c.page ?? "?"}
                    {!c.verified && <span className="ml-1 text-bad">(quotation not verified)</span>}
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <div className="shrink-0">
            <ReviewPanel itemKey={f.key} basis={f.basis} kind="finding" aiSuggestion={f.provenance !== "code"} />
          </div>
        </li>
      ))}
    </ul>
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
      {state.error && <span className="text-xs text-bad">{state.error}</span>}
    </span>
  );
}
