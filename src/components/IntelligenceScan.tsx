"use client";

import { useGapReport } from "@/lib/use-report";

export type ScanStep = "prepare" | "analysis" | "checks" | "mapping";
export type ScanStatus = "idle" | "running" | "done" | "failed" | "skipped";

export const SCAN_LABEL: Record<ScanStep, { title: string; detail: string }> = {
  prepare: { title: "Preparing the dossier", detail: "Listing the readable documents." },
  analysis: { title: "Reading the evidence", detail: "AI request: reads each document and compares them." },
  checks: { title: "Checking for inconsistencies", detail: "Code compares identifiers, names, specs and dates exactly." },
  mapping: { title: "Matching regulatory evidence", detail: "AI request: finds passages per requirement; code verifies every quote." },
};

const short = (s: string) => {
  const b = s.replace(/\.pdf$/i, "").replace(/^\d+_/, "").replace(/_/g, " ");
  return b.length > 18 ? `${b.slice(0, 17)}…` : b;
};

/** Document nodes; a scan beam while documents are read; flowing paths while evidence is matched. */
function ScanVisual({ docs, step, pairs }: { docs: string[]; step: ScanStep | null; pairs: [number, number][] }) {
  const W = 420;
  const H = 210;
  const shown = docs.slice(0, 6);
  const dy = H / (shown.length + 1);
  const x = 250;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" aria-hidden>
      {step === "mapping" &&
        Array.from({ length: 6 }, (_, i) => (
          <g key={i}>
            {shown.map((_, j) => (
              <line key={j} x1={70} y1={(H / 7) * (i + 1)} x2={x - 14} y2={dy * (j + 1)} stroke="rgba(138,92,255,0.35)" strokeWidth={0.8} className="dash-flow" />
            ))}
            <circle cx={66} cy={(H / 7) * (i + 1)} r={3.5} fill="#8a5cff" />
          </g>
        ))}
      {pairs.map(([a, b], k) => (
        <path
          key={k}
          d={`M ${x + 14} ${dy * (a + 1)} C ${x + 80} ${dy * (a + 1)}, ${x + 80} ${dy * (b + 1)}, ${x + 14} ${dy * (b + 1)}`}
          fill="none"
          stroke="#ff315a"
          strokeWidth={1.4}
          className="anim-draw"
          style={{ ["--len" as string]: 220, ["--d" as string]: `${k * 120}ms` }}
        />
      ))}
      {shown.map((name, i) => (
        <g key={name}>
          <rect x={x - 10} y={dy * (i + 1) - 12} width={20} height={24} rx={3} fill="#10131e" stroke="#39e7ff" strokeWidth={1.2} />
          <text x={x - 18} y={dy * (i + 1) + 4} textAnchor="end" fontSize="10" fill="rgba(244,243,239,0.7)">
            {short(name)}
          </text>
        </g>
      ))}
      {(step === "analysis" || step === "prepare") && shown.length > 0 && (
        <rect x={x - 70} y={0} width={140} height={2} fill="#39e7ff" className="anim-scan" style={{ filter: "drop-shadow(0 0 8px #39e7ff)" }} />
      )}
    </svg>
  );
}

/**
 * Inline scan panel. Every stage shown maps to a real operation; no percentages are invented and
 * errors stay visible. Results appear only once the saved results have actually changed.
 */
export function IntelligenceScan({
  steps,
  status,
  errors,
  previous,
  elapsed,
  finished,
  onRetry,
}: {
  steps: ScanStep[];
  status: Record<ScanStep, ScanStatus>;
  errors: Partial<Record<ScanStep, string>>;
  previous: { analysis: string | null; mapping: string | null } | null;
  elapsed: number;
  finished: boolean;
  onRetry: () => void;
}) {
  const { report, uploads } = useGapReport();
  const readable = uploads.uploads.filter((u) => u.status === "extracted").map((u) => u.filename);
  const active = steps.find((s) => status[s] === "running") ?? null;
  const failed = steps.find((s) => status[s] === "failed") ?? null;
  const fresh =
    finished &&
    !failed &&
    previous !== null &&
    (!steps.includes("analysis") || Boolean(report.analysis && report.analysis.createdAt !== previous.analysis)) &&
    (!steps.includes("mapping") || Boolean(report.mapping && report.mapping.createdAt !== previous.mapping));

  const names = readable.slice(0, 6);
  const pairs: [number, number][] = [];
  if (status.checks === "done") {
    for (const f of report.findings.filter((x) => x.group === "discrepancy" && !x.dismissed)) {
      const idx = [...new Set(f.citations.map((c) => names.indexOf(c.filename)).filter((i) => i >= 0))];
      if (idx.length >= 2 && !pairs.some(([a, b]) => a === idx[0] && b === idx[1])) pairs.push([idx[0], idx[1]]);
    }
  }

  return (
    <section aria-label="Analysis progress" className="panel anim-fade-up rounded-2xl p-5 sm:p-6">
      <div className="flex items-baseline justify-between gap-4">
        <div className="font-mono text-[11px] uppercase tracking-[0.24em] text-ion">
          {failed ? "Scan stopped" : fresh ? "Scan complete" : active ? "Scanning" : finished ? "Updating results" : "Starting"}
        </div>
        <div className="font-mono text-xs tabular-nums text-porcelain/50">{elapsed}s</div>
      </div>
      <div className="mt-4 grid gap-6 md:grid-cols-[1fr_1.1fr]">
        <ol className="space-y-3" aria-live="polite">
          {steps.map((s) => (
            <li key={s} className="flex gap-3">
              <span
                aria-hidden
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold transition-colors duration-300 ${
                  status[s] === "done"
                    ? "border-ion bg-ion text-obsidian"
                    : status[s] === "running"
                      ? "anim-pulse border-ion text-ion"
                      : status[s] === "failed"
                        ? "border-crimson text-crimson"
                        : "border-porcelain/20 text-porcelain/30"
                }`}
              >
                {status[s] === "done" ? "✓" : status[s] === "failed" ? "!" : status[s] === "running" ? "•" : ""}
              </span>
              <div>
                <div className={`text-sm font-medium ${status[s] === "idle" ? "text-porcelain/40" : "text-porcelain"}`}>
                  {SCAN_LABEL[s].title}
                  {s === "prepare" && status.prepare === "done" && (
                    <span className="font-normal text-porcelain/60"> · {readable.length} document{readable.length === 1 ? "" : "s"} queued</span>
                  )}
                </div>
                <div className="text-xs text-porcelain/45">{SCAN_LABEL[s].detail}</div>
                {errors[s] && <div className="mt-1 text-xs text-crimson">{errors[s]}</div>}
              </div>
            </li>
          ))}
        </ol>
        <div className="rounded-xl border hairline bg-obsidian/60 p-3">
          <ScanVisual docs={readable} step={active} pairs={pairs} />
        </div>
      </div>

      {failed && (
        <div role="alert" className="mt-5 rounded-lg border border-crimson/40 bg-crimson/10 px-4 py-3 text-sm text-porcelain">
          <strong className="text-crimson">{SCAN_LABEL[failed].title} failed.</strong> {errors[failed]} Earlier results are unchanged.
          <button type="button" onClick={onRetry} className="ml-2 underline">
            Retry
          </button>
        </div>
      )}

      {fresh && (
        <div className="mt-6 grid grid-cols-3 gap-4 border-t hairline pt-5">
          {[
            { label: "Evidence passages found", value: report.counts.display.found, cls: "text-ion" },
            { label: "Potential inconsistencies", value: report.counts.discrepanciesOpen, cls: "text-crimson" },
            { label: "Items needing review", value: report.counts.awaitingReview, cls: "text-lime" },
          ].map((x, i) => (
            <div key={x.label} className="anim-fade-up" style={{ ["--d" as string]: `${i * 90}ms` }}>
              <div className={`text-3xl font-semibold tabular-nums ${x.cls}`}>{x.value}</div>
              <div className="text-xs text-porcelain/60">{x.label}</div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
