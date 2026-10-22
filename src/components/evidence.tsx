"use client";

import { useState } from "react";
import type { CheckedCitation } from "@/lib/analysis";
import { actions, useAppState } from "@/lib/store";
import type { Finding, Severity } from "@/lib/types";
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

/** Human review control. Decisions are stored in this browser, keyed by `decisionKey`. */
export function ReviewControls({ decisionKey, accept = "Accept" }: { decisionKey: string; accept?: string }) {
  const { decisions } = useAppState();
  const d = decisions[decisionKey] ?? "undecided";
  return (
    <div className="flex flex-col gap-1">
      <div className="flex gap-1">
        <Button
          variant={d === "approved" ? "primary" : "secondary"}
          aria-pressed={d === "approved"}
          onClick={() => actions.setDecision(decisionKey, d === "approved" ? "undecided" : "approved")}
        >
          {accept}
        </Button>
        <Button
          variant={d === "rejected" ? "danger" : "secondary"}
          aria-pressed={d === "rejected"}
          onClick={() => actions.setDecision(decisionKey, d === "rejected" ? "undecided" : "rejected")}
        >
          Reject
        </Button>
      </div>
      <span className="text-xs text-mute">
        {d === "approved" ? "Accepted by reviewer" : d === "rejected" ? "Rejected by reviewer" : "Needs human review"}
      </span>
    </div>
  );
}

const SEVERITY_TONE: Record<Severity, "bad" | "warn" | "neutral"> = { fail: "bad", warn: "warn", info: "neutral" };
const SEVERITY_LABEL: Record<Severity, string> = { fail: "Discrepancy", warn: "Check", info: "Note" };

/** Deterministic findings with conflicting values, sources, passages and review status. */
export function FindingList({ findings, empty }: { findings: Finding[]; empty: string }) {
  if (findings.length === 0) return <p className="text-sm text-ink-soft">{empty}</p>;
  return (
    <ul className="space-y-4">
      {findings.map((f) => (
        <li key={f.id} className="flex flex-col gap-3 border-b border-line/60 pb-4 last:border-0 last:pb-0 md:flex-row">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={SEVERITY_TONE[f.severity]}>{SEVERITY_LABEL[f.severity]}</Badge>
              <span className="text-xs text-mute">{f.check}</span>
            </div>
            <div className="mt-1 text-sm font-medium text-ink">{f.title}</div>
            <p className="text-sm text-ink-soft">{f.detail}</p>
            <ul className="mt-2 space-y-1">
              {f.citations.map((c, i) => (
                <li key={i} className="border-l-2 border-teal pl-2 text-sm">
                  {c.value && <span className="mr-2 font-mono text-xs text-ink">{c.value}</span>}
                  <span className="italic text-ink-soft">&ldquo;{c.quote}&rdquo;</span>
                  <div className="text-xs text-mute">
                    {c.filename}, page {c.page}
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <div className="shrink-0">
            <ReviewControls decisionKey={`cc:${f.id}`} accept="Confirm" />
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
