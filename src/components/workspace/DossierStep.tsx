"use client";

import { useRef, useState } from "react";
import { CDSCO_MFG_BCD } from "@/lib/requirements";
import { useShared } from "@/lib/shared-fetch";
import { useGapReport } from "@/lib/use-report";
import { loadSyntheticDemo, startOwnDossier, useUploader } from "@/lib/use-uploader";
import { MAX_UPLOADS_PER_WORKSPACE, type UploadedDocument } from "@/lib/uploads";
import { AnalyzeAction } from "../AnalyzeAction";
import { DevicePathway } from "../experience/DevicePathway";
import { EngineRoom } from "../experience/EngineRoom";
import { ProveItsReal } from "../experience/ProveItsReal";
import { Drawer } from "../ui";
import { RunProgress } from "./RunProgress";

const STATUS = {
  extracted: { label: "Text extracted", cls: "text-ion", dot: "bg-ion" },
  needs_ocr: { label: "No extractable text — OCR may be required", cls: "text-lime", dot: "bg-lime" },
  failed: { label: "Could not be read", cls: "text-crimson", dot: "bg-crimson" },
} as const;

/** The real extracted text, page by page. */
function DocumentText({ workspaceId, id }: { workspaceId: string; id: string }) {
  const e = useShared(`doc:${workspaceId}:${id}`, async () => {
    const res = await fetch(`/api/documents/${id}?workspaceId=${encodeURIComponent(workspaceId)}`);
    const j = await res.json();
    if (!res.ok) throw new Error(j.error ?? "Could not load the text.");
    return j.document as UploadedDocument;
  });
  if (e.error) return <p className="text-sm text-bad">{e.error}</p>;
  if (!e.data) return <p className="text-sm text-mute">Loading text…</p>;
  return (
    <div className="space-y-4">
      <p className="text-xs text-mute">Raw text as extracted from the PDF. Layout, tables and images are not preserved.</p>
      {e.data.pages.map((p) => (
        <section key={p.page}>
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-teal-dark">Page {p.page}</h3>
          {p.text ? (
            <pre className="whitespace-pre-wrap break-words rounded-lg bg-background p-3 font-mono text-xs leading-relaxed text-ink">{p.text}</pre>
          ) : (
            <p className="rounded-lg bg-warn-soft p-3 text-xs text-warn">No extractable text on this page — OCR may be required.</p>
          )}
        </section>
      ))}
    </div>
  );
}

function Collapsible({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return (
    <details className="group rounded-xl border hairline">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-4 py-2.5 text-sm hover:bg-porcelain/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-ion">
        <span>
          <span className="font-medium">{title}</span> <span className="text-xs text-porcelain/45">{hint}</span>
        </span>
        <span aria-hidden className="text-porcelain/40 transition-transform group-open:rotate-90">
          ›
        </span>
      </summary>
      <div className="border-t hairline p-4">{children}</div>
    </details>
  );
}

export function DossierStep({ onNext }: { onNext: () => void }) {
  const { state, results, uploads: up, loading, refresh } = useGapReport();
  const uploads = up.uploads;
  const ws = state.workspaceId;
  const u = useUploader(ws, uploads.length);
  const input = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [viewing, setViewing] = useState<{ id: string; filename: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const readable = uploads.filter((d) => d.status === "extracted").length;

  async function analyseOwn() {
    setError(null);
    if (state.isDemo) await startOwnDossier();
    input.current?.click();
  }
  async function tryDemo() {
    setBusy("Loading the synthetic demo…");
    setError(null);
    try {
      await loadSyntheticDemo();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      <h1 id="step-dossier" tabIndex={-1} className="sr-only">
        Step 1: Dossier
      </h1>
      {/* Compact intro: what this is, and the two ways in. */}
      <section className="flex flex-col gap-3 rounded-2xl border hairline bg-gradient-to-r from-ion/[0.07] via-transparent to-crimson/[0.06] px-5 py-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xl font-semibold tracking-tight sm:text-2xl">Know what your dossier is missing.</p>
          <p className="mt-0.5 text-sm text-porcelain/60">Trace evidence. Find inconsistencies. Assess applicable CDSCO requirements.</p>
          <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.18em] text-porcelain/40">
            <span className="text-ultra">AI proposes</span> → <span className="text-ion">code verifies</span> → <span className="text-lime">you decide</span>
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <button
            type="button"
            onClick={analyseOwn}
            className="press rounded-full bg-ion px-5 py-2 text-sm font-semibold text-obsidian shadow-[0_0_24px_rgba(57,231,255,0.3)] hover:bg-porcelain focus:outline-none focus-visible:ring-2 focus-visible:ring-porcelain"
          >
            Analyse a dossier
          </button>
          <button
            type="button"
            onClick={tryDemo}
            disabled={Boolean(busy)}
            className="press rounded-full border border-porcelain/30 px-5 py-2 text-sm text-porcelain hover:border-lime hover:text-lime focus:outline-none focus-visible:ring-2 focus-visible:ring-lime disabled:opacity-50"
          >
            {busy ?? "Try synthetic demo"}
          </button>
        </div>
      </section>
      {error && <p role="alert" className="text-sm text-crimson">{error}</p>}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.2fr_1fr] [&>*]:min-w-0">
        {/* Documents */}
        <section aria-labelledby="docs-title" className="panel flex flex-col rounded-2xl p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 id="docs-title" className="font-mono text-[11px] uppercase tracking-[0.2em] text-porcelain/60">
              Documents <span className="text-porcelain/35">{uploads.length}/{MAX_UPLOADS_PER_WORKSPACE}</span>
            </h2>
            {state.isDemo && <span className="rounded-full border border-lime/60 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.16em] text-lime">Synthetic demo data</span>}
          </div>
          <input
            ref={input}
            type="file"
            accept="application/pdf,.pdf"
            multiple
            className="hidden"
            onChange={(e) => {
              const files = e.target.files ? Array.from(e.target.files) : [];
              e.target.value = "";
              void u.upload(files);
            }}
          />
          <button
            type="button"
            onClick={() => input.current?.click()}
            disabled={u.slotsLeft <= 0}
            onDragOver={(e) => {
              e.preventDefault();
              setDrag(true);
            }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDrag(false);
              void u.upload(e.dataTransfer.files);
            }}
            className={`press relative flex w-full items-center justify-center gap-3 overflow-hidden rounded-xl border border-dashed px-4 py-5 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ion disabled:cursor-not-allowed disabled:opacity-50 ${
              drag ? "border-ion bg-ion/10" : "border-porcelain/25 hover:border-ion/70 hover:bg-ion/5"
            }`}
          >
            {u.pending.length > 0 && <span aria-hidden className="anim-scan absolute inset-x-0 top-0 h-px bg-ion shadow-[0_0_12px_2px_rgba(57,231,255,0.6)]" />}
            <span aria-hidden className="text-2xl text-ion">⬡</span>
            <span>
              <span className="block text-sm font-semibold">{u.pending.length ? `Extracting text from ${u.pending.length} file${u.pending.length === 1 ? "" : "s"}…` : "Drop PDFs here or choose files"}</span>
              <span className="block text-xs text-porcelain/50">Text-based PDFs · max 4 MB each · validated and extracted on the server</span>
            </span>
          </button>
          {u.errors.length > 0 && (
            <div role="alert" className="mt-3 rounded-lg border border-crimson/40 bg-crimson/10 px-3 py-2 text-xs">
              <ul className="space-y-0.5 text-porcelain/85">
                {u.errors.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
              <button type="button" onClick={u.clearErrors} className="mt-1 underline">
                Dismiss
              </button>
            </div>
          )}
          <ul className="mt-3 min-h-12 flex-1 divide-y divide-porcelain/10 pr-1 lg:max-h-[34vh] lg:overflow-auto" aria-label="Documents in this dossier">
            {loading && uploads.length === 0 && <li className="py-2 text-sm text-porcelain/50">Loading documents…</li>}
            {!loading && uploads.length === 0 && u.pending.length === 0 && <li className="py-2 text-sm text-porcelain/45">No documents yet.</li>}
            {uploads.map((d) => {
              const st = STATUS[d.status];
              return (
                <li key={d.id} className={`flex items-center gap-3 py-2 ${u.justAdded.includes(d.id) ? "anim-confirm" : ""}`}>
                  <span aria-hidden className={`h-2 w-2 shrink-0 rounded-full ${st.dot}`} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm" title={d.filename}>
                      {d.filename}
                    </div>
                    <div className={`text-[11px] ${st.cls}`}>
                      {st.label}
                      {d.status === "extracted" && (
                        <span className="text-porcelain/45">
                          {" "}
                          · {d.pageCount} page{d.pageCount === 1 ? "" : "s"}
                          {d.extractMs !== undefined && ` · ${d.extractMs} ms`}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={d.status === "failed"}
                    onClick={() => setViewing({ id: d.id, filename: d.filename })}
                    className="press shrink-0 rounded-full border hairline px-2.5 py-0.5 text-[11px] hover:border-ion/60 disabled:opacity-30"
                  >
                    Text
                  </button>
                  <button type="button" onClick={() => u.remove(d.id, d.filename)} aria-label={`Remove ${d.filename}`} className="press shrink-0 px-1 text-xs text-porcelain/40 hover:text-crimson">
                    ✕
                  </button>
                </li>
              );
            })}
            {u.pending.map((name) => (
              <li key={`p-${name}`} className="flex items-center gap-3 py-2 text-sm">
                <span aria-hidden className="anim-pulse h-2 w-2 rounded-full bg-ion" />
                <span className="min-w-0 flex-1 truncate">{name}</span>
                <span className="text-[11px] text-ion">Extracting…</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Device, pathway, analyse */}
        <div className="flex flex-col gap-4">
          <DevicePathway />
          <section aria-labelledby="analyse-title" className="panel rounded-2xl p-4">
            <h2 id="analyse-title" className="mb-3 font-mono text-[11px] uppercase tracking-[0.2em] text-porcelain/60">
              Analyse
            </h2>
            <AnalyzeAction workspaceId={ws} set={CDSCO_MFG_BCD} aiConfigured={results.aiConfigured} readableDocs={readable} hasResults={Boolean(results.analysis)} onDone={refresh} />
            {results.error && <p className="mt-2 text-xs text-crimson">{results.error}</p>}
            <div className="mt-3">
              <RunProgress workspaceId={ws} onNext={onNext} />
            </div>
            {results.analysis && (
              <button type="button" onClick={onNext} className="press mt-3 text-xs text-ion underline-offset-4 hover:underline">
                {results.analysis.source === "demo-seed" ? "See the demo findings →" : "See findings from the latest analysis →"}
              </button>
            )}
          </section>
        </div>
      </div>

      <Collapsible title="View analysis details" hint="Engine Room: server events, timings, AI requests, quote checks">
        <EngineRoom />
      </Collapsible>
      <Collapsible title="Demo tests" hint="Reject a bad file, a scanned PDF, an unsupported quote, prompt injection">
        <ProveItsReal />
      </Collapsible>

      <Drawer open={Boolean(viewing)} onClose={() => setViewing(null)} eyebrow="Extracted text" title={viewing?.filename ?? ""}>
        {viewing && <DocumentText workspaceId={ws} id={viewing.id} />}
      </Drawer>
    </div>
  );
}
