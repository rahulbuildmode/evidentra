"use client";

import { useEffect, useState, type ReactNode } from "react";
import { inspector } from "@/lib/inspector-store";
import { VALIDATION_LABEL, type ValidationStatus } from "@/lib/regulatory/types";
import { STEP_KEYS, STEP_LABEL, type QuoteRecord, type RunRecord, type StepKey } from "@/lib/run";
import { runActions, useRunList, useRunSession, useSavedRun } from "@/lib/run-client";
import { applyEvents, emptyView, type RunView } from "@/lib/run-view";
import { useGapReport } from "@/lib/use-report";
import { CHECK_LABEL } from "../EvidenceInspector";
import { Drawer } from "../ui";

const fmtTime = (iso: string | null) => (iso ? new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "medium" }) : "Not recorded");
const fmtMs = (ms: number | null) => (ms === null ? "Not recorded" : ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`);

const STATUS_STYLE = {
  pending: { icon: "", ring: "border-porcelain/20 text-porcelain/30", text: "Waiting" },
  running: { icon: "•", ring: "anim-pulse border-ion text-ion", text: "Running" },
  completed: { icon: "✓", ring: "border-ion bg-ion text-obsidian", text: "Completed" },
  failed: { icon: "!", ring: "border-crimson text-crimson", text: "Failed" },
  skipped: { icon: "–", ring: "border-porcelain/30 text-porcelain/50", text: "Skipped" },
} as const;

function Chip({ children, tone }: { children: ReactNode; tone: "live" | "saved" | "demo" | "fail" }) {
  const cls = {
    live: "border-ion/60 text-ion",
    saved: "border-porcelain/50 text-porcelain",
    demo: "border-lime/60 text-lime",
    fail: "border-crimson/60 text-crimson",
  }[tone];
  return <span className={`rounded-full border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.2em] ${cls}`}>{children}</span>;
}

/** A count that opens its records, or plain text when there are none to show. */
function Count({ n, label, onOpen, tone = "text-porcelain" }: { n: number | null; label: string; onOpen?: () => void; tone?: string }) {
  const body = (
    <>
      <span className={`block text-2xl font-semibold tabular-nums ${tone}`}>{n === null ? "—" : n}</span>
      <span className="block text-xs text-porcelain/60">{n === null ? `${label}: not recorded` : label}</span>
    </>
  );
  return onOpen && n ? (
    <button type="button" onClick={onOpen} className="press rounded-lg p-2 text-left hover:bg-porcelain/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-ion">
      {body}
      <span className="mt-0.5 block text-[10px] uppercase tracking-[0.16em] text-ion/80">Inspect →</span>
    </button>
  ) : (
    <div className="p-2">{body}</div>
  );
}

type ListKind = { title: string; kind: "docs" | "skipped" | "checks" | "attempts"; } | { title: string; kind: "quotes"; filter: QuoteRecord["check"] | "all" };

function quoteOrigin(r: RunRecord): "AI proposal" | "Demo seed" {
  return r.kind === "demo-seed" ? "Demo seed" : "AI proposal";
}

function RecordList({ list, record }: { list: ListKind; record: RunRecord }) {
  if (list.kind === "docs" || list.kind === "skipped") {
    const docs = record.documents.filter((d) => (list.kind === "docs" ? d.included : !d.included));
    return (
      <ul className="divide-y divide-line text-sm">
        {docs.map((d) => (
          <li key={d.id} className="py-3">
            <div className="break-all font-medium text-ink">{d.filename}</div>
            <div className="text-xs text-mute">
              {d.pages ?? "?"} page{d.pages === 1 ? "" : "s"} · extraction {fmtMs(d.extractMs)} · uploaded {fmtTime(d.uploadedAt)}
              {d.charsSent !== undefined && ` · ${d.charsSent.toLocaleString()} characters sent to the AI${d.truncated ? " (truncated)" : ""}`}
            </div>
            {d.reason && <div className="mt-1 text-xs text-warn">Skipped: {d.reason}</div>}
          </li>
        ))}
      </ul>
    );
  }
  if (list.kind === "checks") {
    return (
      <ul className="divide-y divide-line text-sm">
        {record.checks.map((c) => (
          <li key={c.id} className="py-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="font-medium text-ink">
                {c.check}: {c.field}
              </span>
              <span className={`text-xs font-semibold ${["consistent", "passed"].includes(c.outcome) ? "text-teal-dark" : "text-bad"}`}>{c.outcome.replace("_", " ")}</span>
            </div>
            <div className="text-xs text-mute">{c.detail}</div>
            <ul className="mt-1 space-y-0.5 text-xs">
              {c.compared.map((v, i) => (
                <li key={i} className="break-all">
                  <span className="font-mono text-ink">{v.value}</span> <span className="text-mute">— {v.filename}, p.{v.page}</span>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    );
  }
  if (list.kind === "attempts") {
    return (
      <ul className="divide-y divide-line text-sm">
        {record.ai.flatMap((s) =>
          s.attempts.map((a) => (
            <li key={`${s.stage}-${a.attempt}`} className="py-3">
              <div className="font-medium text-ink">
                {s.stage === "analysis" ? "AI request 1" : "AI request 2"} · network request {a.attempt}
              </div>
              <div className="text-xs text-mute">
                {fmtTime(a.startedAt)} · {fmtMs(a.durationMs)} · HTTP {a.httpStatus ?? "no response"} · {a.outcome.replace("_", " ")} · model {a.model ?? s.model}
              </div>
              <div className="text-xs text-mute">
                Tokens: {a.promptTokens === null && a.outputTokens === null ? "Token usage unavailable" : `${a.promptTokens ?? "?"} in / ${a.outputTokens ?? "?"} out`}
              </div>
              {a.note && <div className="mt-1 text-xs text-warn">{a.note}</div>}
            </li>
          )),
        )}
      </ul>
    );
  }
  const filter = list.kind === "quotes" ? list.filter : "all";
  const quotes = record.quotes.filter((q) => filter === "all" || q.check === filter);
  return (
    <ul className="divide-y divide-line text-sm">
      {quotes.map((q, i) => (
        <li key={i} className="py-3">
          <button
            type="button"
            className="w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-teal"
            onClick={() =>
              inspector.open({
                kind: "quote",
                quote: {
                  origin: quoteOrigin(record),
                  context: q.context,
                  quote: q.quote,
                  proposedFilename: q.proposedFilename,
                  proposedPage: q.proposedPage,
                  check: q.check,
                  verifiedPage: q.verifiedPage,
                  workspaceId: record.workspaceId,
                },
              })
            }
          >
            <div className="text-xs text-mute">
              {q.source === "analysis" ? "AI request 1" : "AI request 2"} · {q.context}
            </div>
            <div className="break-words italic text-ink">“{q.quote}”</div>
            <div className="text-xs">
              <span className="break-all text-mute">
                {q.proposedFilename} · proposed p.{q.proposedPage ?? "?"}
              </span>{" "}
              <span className={CHECK_LABEL[q.check].cls}>· {CHECK_LABEL[q.check].text}</span>
              {q.check === "verified_other_page" && <span className="text-warn"> (actual p.{q.verifiedPage})</span>}
            </div>
          </button>
        </li>
      ))}
    </ul>
  );
}

function Timeline({ view, record }: { view: RunView; record: RunRecord | null }) {
  // `record` is passed only once the run (or its replay) has finished.
  const attempts = (step: StepKey) => view.events.filter((e) => e.step === step && (e.type === "ai_request_started" || e.type === "ai_attempt" || e.type === "ai_fallback"));
  return (
    <ol className="space-y-4" aria-live="polite" aria-label="Pipeline steps">
      {STEP_KEYS.map((k) => {
        // A finished saved run carries the server's own step records; prefer them over the event-derived view.
        const saved = record && record.status !== "running" ? record.steps.find((x) => x.key === k) : null;
        const s = saved ?? view.steps[k];
        const st = STATUS_STYLE[s.status];
        const ai = attempts(k);
        return (
          <li key={k} className="flex gap-3">
            <span aria-hidden className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold ${st.ring}`}>
              {st.icon}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <span className={`text-sm font-medium ${s.status === "pending" ? "text-porcelain/40" : "text-porcelain"}`}>{STEP_LABEL[k]}</span>
                <span className="font-mono text-[11px] tabular-nums text-porcelain/50">
                  {st.text}
                  {(s.status === "completed" || s.status === "failed") && ` · ${fmtMs(s.durationMs)}`}
                </span>
              </div>
              {s.note && <div className={`text-xs ${s.status === "failed" ? "text-crimson" : "text-porcelain/55"}`}>{s.note}</div>}
              {ai.length > 0 && (
                <ul className="mt-1 space-y-0.5 border-l border-porcelain/15 pl-3 font-mono text-[11px] text-porcelain/55">
                  {ai.map((e) => (
                    <li key={e.seq}>
                      {e.type === "ai_fallback"
                        ? `⇢ ${e.message}`
                        : e.type === "ai_request_started"
                          ? `→ ${e.message}`
                          : `← HTTP ${e.data?.httpStatus ?? "—"} · ${fmtMs(typeof e.data?.durationMs === "number" ? e.data.durationMs : null)} · ${String(e.data?.outcome ?? "").replace("_", " ")}`}
                    </li>
                  ))}
                </ul>
              )}
              {k === "extraction" && record && record.documents.length > 0 && s.status === "completed" && (
                <div className="mt-1 text-[11px] text-porcelain/45">
                  Extraction at upload:{" "}
                  {record.documents
                    .filter((d) => d.included)
                    .map((d) => `${d.filename.replace(/\.pdf$/i, "")} ${fmtMs(d.extractMs)}`)
                    .join(" · ")}
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function Metrics({ record, open }: { record: RunRecord; open: (l: ListKind) => void }) {
  const q = (k: QuoteRecord["check"]) => record.quotes.filter((x) => x.check === k).length;
  const attempts = record.ai.flatMap((s) => s.attempts);
  const retries = record.ai.reduce((n, s) => n + Math.max(0, s.attempts.length - 1), 0);
  const tokIn = attempts.map((a) => a.promptTokens).filter((x): x is number => x !== null);
  const tokOut = attempts.map((a) => a.outputTokens).filter((x): x is number => x !== null);
  const included = record.documents.filter((d) => d.included).length;
  const flagged = record.checks.filter((c) => !["consistent", "passed"].includes(c.outcome)).length;
  return (
    <div className="space-y-5">
      <div>
        <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-porcelain/45">Documents</div>
        <div className="mt-1 grid grid-cols-2 gap-1">
          <Count n={included} label="processed" onOpen={() => open({ title: "Documents processed", kind: "docs" })} />
          <Count n={record.documents.length - included} label="skipped" tone="text-lime" onOpen={() => open({ title: "Documents skipped", kind: "skipped" })} />
        </div>
      </div>
      <div>
        <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-porcelain/45">AI requests</div>
        {record.ai.length === 0 ? (
          <p className="mt-1 p-2 text-xs text-porcelain/60">No AI request was made in this run{record.kind === "demo-seed" ? " (demo seed)" : ""}.</p>
        ) : (
          <>
            <div className="mt-1 grid grid-cols-3 gap-1">
              <Count n={record.ai.length} label="logical stages" />
              <Count n={attempts.length} label="network requests" onOpen={() => open({ title: "AI network requests", kind: "attempts" })} />
              <Count n={retries} label="retries" />
            </div>
            <p className="px-2 text-xs text-porcelain/55">
              Model {[...new Set(record.ai.map((s) => s.model))].join(", ")} ·{" "}
              {tokIn.length === 0 && tokOut.length === 0
                ? "Token usage unavailable"
                : `${tokIn.reduce((a, b) => a + b, 0).toLocaleString()} input / ${tokOut.reduce((a, b) => a + b, 0).toLocaleString()} output tokens (reported by the Gemini API)`}
            </p>
            {record.ai.flatMap((s) => s.fallback ?? []).map((f, i) => (
              <p key={i} className="px-2 text-xs text-lime">
                Fallback: {f.reason}, so {f.to} was used instead of {f.from}.
              </p>
            ))}
          </>
        )}
      </div>
      <div>
        <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-porcelain/45">Quotations checked by code</div>
        <div className="mt-1 grid grid-cols-3 gap-1 sm:grid-cols-5">
          <Count n={record.quotes.length} label="proposed" onOpen={() => open({ title: "All proposed quotations", kind: "quotes", filter: "all" })} />
          <Count n={q("verified")} label="verified" tone="text-ion" onOpen={() => open({ title: "Verified on the cited page", kind: "quotes", filter: "verified" })} />
          <Count n={q("verified_other_page")} label="other page" tone="text-lime" onOpen={() => open({ title: "Found on another page", kind: "quotes", filter: "verified_other_page" })} />
          <Count n={q("not_found")} label="not found" tone="text-crimson" onOpen={() => open({ title: "Not found in extracted text", kind: "quotes", filter: "not_found" })} />
          <Count n={q("unknown_file")} label="unknown file" tone="text-crimson" onOpen={() => open({ title: "Unknown file", kind: "quotes", filter: "unknown_file" })} />
        </div>
      </div>
      {record.validation && (
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-porcelain/45">CDSCO requirements validated (code)</div>
          <p className="mt-1 px-2 text-xs text-porcelain/70">{record.validation.decision}</p>
          <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1 px-2 text-xs text-porcelain/70">
            {Object.entries(record.validation.counts).map(([k, n]) => (
              <li key={k}>
                <span className="tabular-nums text-porcelain">{n}</span> {VALIDATION_LABEL[k as ValidationStatus].toLowerCase()}
              </li>
            ))}
          </ul>
          <a href="#report" className="mt-1 inline-block px-2 text-[10px] uppercase tracking-[0.16em] text-ion/80">
            Per-requirement results in the Readiness Brief →
          </a>
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-porcelain/45">Deterministic checks</div>
          <div className="mt-1 grid grid-cols-2 gap-1">
            <Count n={record.checks.length} label="executed" onOpen={() => open({ title: "Deterministic checks executed", kind: "checks" })} />
            <Count n={flagged} label="flagged" tone="text-crimson" />
          </div>
        </div>
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-porcelain/45">Findings produced</div>
          {record.findings ? (
            <ul className="mt-2 space-y-0.5 px-2 text-xs text-porcelain/70">
              {Object.entries(record.findings.byStatus).map(([k, v]) => (
                <li key={k}>
                  <span className="tabular-nums text-porcelain">{v}</span> {k}
                </li>
              ))}
              {record.findings.requirements && (
                <li className="pt-1 text-porcelain/55">
                  Requirements: {Object.entries(record.findings.requirements).map(([k, v]) => `${v} ${k.replace("_", " ")}`).join(" · ")}
                </li>
              )}
            </ul>
          ) : (
            <p className="mt-2 px-2 text-xs text-porcelain/55">None — the run stopped before producing results.</p>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Engine Room: the real trace of one pipeline run — live while it streams, or a saved run labelled
 * as such. Every number comes from the server's run record; missing values say "Not recorded".
 */
export function EngineRoom() {
  const { state, report } = useGapReport();
  const ws = state.workspaceId;
  const session = useRunSession();
  const mine = session && session.workspaceId === ws ? session : null;
  const { runs } = useRunList(ws);
  const latest = runs[0] ?? null;
  const saved = useSavedRun(ws, mine ? null : (latest?.runId ?? null));
  const record = mine ? mine.record : saved;
  const view = mine ? mine.view : saved ? applyEvents(emptyView(), saved.events) : null;
  const isLive = mine?.mode === "live";
  const kind = record?.kind ?? (isLive ? "live" : null);
  const lastLive = runs.find((r) => r.kind === "live") ?? null;
  const [list, setList] = useState<ListKind | null>(null);
  const [now, setNow] = useState(0);

  const streaming = Boolean(mine && ["connecting", "streaming", "reconnecting"].includes(mine.connection));
  const playing = mine?.mode === "replay" && streaming;
  const finished = record && record.status !== "running" && !playing ? record : null;
  useEffect(() => {
    if (!streaming) return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [streaming]);

  const stale =
    view?.status === "failed" && view.startedAt && report.analysis && report.analysis.createdAt < view.startedAt ? report.analysis.createdAt : null;
  const mappingOlder =
    report.analysis && report.mapping && report.mapping.source === "gemini" && report.mapping.createdAt < report.analysis.createdAt ? report.mapping.createdAt : null;

  return (
    <section id="engine-room" aria-labelledby="engine-room-title" className="panel scroll-mt-24 rounded-2xl p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="font-mono text-[11px] uppercase tracking-[0.24em] text-ion">Engine Room</div>
          <h3 id="engine-room-title" className="mt-1 text-xl font-semibold">
            What the server actually did
          </h3>
          <p className="mt-1 max-w-xl text-sm text-porcelain/60">Each step is recorded on the server as it runs: timestamps, durations, AI requests, quotations checked and comparisons executed.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isLive && view?.status === "running" && <Chip tone="live">● Live run</Chip>}
          {isLive && view?.status !== "running" && <Chip tone="live">Live run · finished</Chip>}
          {!isLive && view && <Chip tone="saved">Saved run — not live</Chip>}
          {kind === "demo-seed" && <Chip tone="demo">Synthetic demo data</Chip>}
          {view?.status === "failed" && <Chip tone="fail">Failed</Chip>}
        </div>
      </div>

      {!view ? (
        <p className="mt-6 text-sm text-porcelain/55">No run recorded for this dossier yet. Upload documents and press Analyse dossier, or load the synthetic sample.</p>
      ) : (
        <>
          <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-2 border-y hairline py-3 text-xs sm:grid-cols-4">
            <div>
              <dt className="text-porcelain/45">Run ID</dt>
              <dd className="break-all font-mono text-porcelain/85">{view.runId ?? "waiting for server…"}</dd>
            </div>
            <div>
              <dt className="text-porcelain/45">Started (server clock)</dt>
              <dd className="text-porcelain/85">{view.startedAt ? fmtTime(view.startedAt) : "waiting for server…"}</dd>
            </div>
            <div>
              <dt className="text-porcelain/45">Ended</dt>
              <dd className="text-porcelain/85">{view.endedAt ? fmtTime(view.endedAt) : playing ? "replaying…" : view.status === "running" ? "still running" : "Not recorded"}</dd>
            </div>
            <div>
              <dt className="text-porcelain/45">Total duration</dt>
              <dd className="tabular-nums text-porcelain/85">
                {view.durationMs !== null
                  ? fmtMs(view.durationMs)
                  : streaming && isLive && mine
                    ? now ? `${Math.max(0, Math.round((now - mine.clientStart) / 1000))} s elapsed (browser timer)` : "running…"
                    : "Not recorded"}
              </dd>
            </div>
          </dl>

          {mine?.mode === "replay" && record && (
            <p className="mt-3 rounded-lg border border-porcelain/30 px-3 py-2 text-xs text-porcelain/80">
              SAVED RUN — NOT LIVE.{" "}
              {playing
                ? `Replaying the events recorded on ${fmtTime(record.startedAt)} at their original timing. Nothing is being re-run.`
                : `Showing the run recorded on ${fmtTime(record.startedAt)}. Nothing was re-run.`}
            </p>
          )}
          {mine?.connection === "reconnecting" && <p className="mt-3 text-xs text-lime">Connection to the live stream dropped — reading the server&apos;s saved progress instead.</p>}
          {mine?.error && (
            <p role="alert" className="mt-3 rounded-lg border border-crimson/40 bg-crimson/10 px-3 py-2 text-sm text-porcelain">
              {mine.error}
            </p>
          )}
          {stale && (
            <p role="status" className="mt-3 rounded-lg border border-lime/40 bg-lime/5 px-3 py-2 text-sm text-porcelain/85">
              This run failed, so it did not replace anything. The results shown on this page are from an earlier run ({fmtTime(stale)}).
            </p>
          )}
          {view.status === "failed" && !stale && view.steps.ai_analysis.status === "completed" && (
            <p role="status" className="mt-3 rounded-lg border border-lime/40 bg-lime/5 px-3 py-2 text-sm text-porcelain/85">
              Partial result: the analysis from this run was saved; the step that failed did not produce results.
            </p>
          )}
          {mappingOlder && !streaming && (
            <p className="mt-3 text-xs text-lime">The requirement matches in the report are from an earlier run ({fmtTime(mappingOlder)}) than the current analysis.</p>
          )}

          <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_1.1fr] [&>*]:min-w-0">
            <Timeline view={view} record={finished} />
            {finished ? (
              <Metrics record={finished} open={setList} />
            ) : (
              <p className="text-sm text-porcelain/55">
                {playing ? "Counts appear when the replay reaches the end." : streaming ? "Counts appear when the server has saved the run." : "Counts not available for this run."}
              </p>
            )}
          </div>

          {finished && (
            <details className="mt-6 rounded-xl border hairline">
              <summary className="cursor-pointer px-4 py-2 text-xs text-porcelain/70 hover:text-porcelain">Raw details: per-document input and recorded events ({finished.events.length})</summary>
              <div className="space-y-4 px-4 pb-4 text-xs">
                <table className="w-full text-left">
                  <thead className="text-porcelain/45">
                    <tr>
                      <th className="py-1 font-normal">Document</th>
                      <th className="font-normal">Pages</th>
                      <th className="font-normal">Characters sent</th>
                      <th className="font-normal">Truncated</th>
                    </tr>
                  </thead>
                  <tbody className="text-porcelain/80">
                    {finished.documents.map((d) => (
                      <tr key={d.id} className="border-t hairline">
                        <td className="break-all py-1 pr-2">{d.filename}</td>
                        <td>{d.pages ?? "—"}</td>
                        <td className="tabular-nums">{d.charsSent === undefined ? "Not sent" : d.charsSent.toLocaleString()}</td>
                        <td>{d.charsSent === undefined ? "—" : d.truncated ? "Yes" : "No"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <ol className="max-h-64 space-y-0.5 overflow-auto font-mono text-[11px] text-porcelain/60">
                  {finished.events.map((e) => (
                    <li key={e.seq} className="break-words">
                      #{e.seq} {e.at.slice(11, 23)} {e.type}
                      {e.step ? ` [${e.step}]` : ""} {e.message ?? ""}
                    </li>
                  ))}
                </ol>
              </div>
            </details>
          )}
        </>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-3 border-t hairline pt-4 text-xs">
        {lastLive ? (
          <button
            type="button"
            disabled={streaming}
            onClick={() => runActions.replay(ws, lastLive.runId)}
            className="press rounded-full border hairline px-3 py-1.5 text-porcelain hover:border-porcelain/50 disabled:opacity-40"
          >
            ▶ Replay last real run ({fmtTime(lastLive.startedAt)})
          </button>
        ) : (
          <span className="text-porcelain/45">Replay becomes available after a live AI run has been recorded in this dossier.</span>
        )}
        {mine && !streaming && (
          <button type="button" onClick={runActions.clear} className="press rounded-full px-3 py-1.5 text-porcelain/60 hover:text-porcelain">
            Show latest saved run
          </button>
        )}
        {runs.length > 1 && (
          <details className="relative">
            <summary className="cursor-pointer list-none rounded-full px-3 py-1.5 text-porcelain/60 hover:text-porcelain">Saved runs ({runs.length}) ▾</summary>
            <ul className="absolute z-10 mt-1 w-72 rounded-xl border hairline bg-obsidian p-2 shadow-xl">
              {runs.map((r) => (
                <li key={r.runId}>
                  <button type="button" onClick={() => runActions.show(ws, r.runId)} className="w-full rounded-lg px-2 py-1.5 text-left hover:bg-porcelain/5">
                    <span className="block text-porcelain/85">{fmtTime(r.startedAt)}</span>
                    <span className="block text-porcelain/45">
                      {r.kind === "demo-seed" ? "Demo seed" : "Live AI run"} · {r.status} · {fmtMs(r.durationMs)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </details>
        )}
        <span className="ml-auto text-porcelain/40">
          Saved on the server&apos;s local disk. On the hosted demo this storage is temporary and can be cleared.
        </span>
      </div>

      <Drawer open={Boolean(list && record)} onClose={() => setList(null)} eyebrow={record ? `Run ${record.runId}` : ""} title={list?.title ?? ""}>
        {list && record && <RecordList list={list} record={record} />}
      </Drawer>
    </section>
  );
}
