"use client";

import { useRef, useState } from "react";
import { CDSCO_MFG_BCD } from "@/lib/requirements";
import { useShared } from "@/lib/shared-fetch";
import { useCaseProgress } from "@/lib/use-case-progress";
import { useGapReport } from "@/lib/use-report";
import { loadSyntheticDemo, startOwnDossier, useUploader } from "@/lib/use-uploader";
import { MAX_UPLOADS_PER_WORKSPACE, type UploadedDocument, type UploadedDocumentMeta } from "@/lib/uploads";
import { AnalyzeAction } from "../AnalyzeAction";
import { DevicePathway } from "../experience/DevicePathway";
import { EngineRoom } from "../experience/EngineRoom";
import { ProveItsReal } from "../experience/ProveItsReal";
import { Drawer } from "../ui";
import { MissionTasks } from "./CaseProgress";
import { RunProgress } from "./RunProgress";

const STATUS = {
  extracted: { label: "Text extracted", cls: "text-ion", dot: "bg-ion" },
  needs_ocr: { label: "No extractable text — OCR may be required", cls: "text-amber", dot: "bg-amber" },
  failed: { label: "Could not be read", cls: "text-coral", dot: "bg-coral" },
} as const;

/** The real extracted text, page by page. */
function DocumentText({ workspaceId, id }: { workspaceId: string; id: string }) {
  const e = useShared(`doc:${workspaceId}:${id}`, async () => {
    const res = await fetch(`/api/documents/${id}?workspaceId=${encodeURIComponent(workspaceId)}`);
    const j = await res.json();
    if (!res.ok) throw new Error(j.error ?? "Could not load the text.");
    return j.document as UploadedDocument;
  });
  if (e.error) return <p className="text-sm text-coral">{e.error}</p>;
  if (!e.data) return <p className="text-sm text-porcelain/55">Loading text…</p>;
  return (
    <div className="space-y-4">
      <p className="text-xs text-porcelain/55">Raw text as extracted from the PDF. Layout, tables and images are not preserved.</p>
      {e.data.pages.map((p) => (
        <section key={p.page}>
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-ion">Page {p.page}</h3>
          {p.text ? (
            <pre className="paper whitespace-pre-wrap break-words p-4 font-mono text-[12px] leading-relaxed">{p.text}</pre>
          ) : (
            <p className="rounded-lg bg-amber/10 p-3 text-xs text-amber">No extractable text on this page — OCR may be required.</p>
          )}
        </section>
      ))}
    </div>
  );
}

const kb = (n: number) => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`);

/** A document card: real extraction status; expands to the metadata the server recorded. */
function DocCard({
  d,
  fresh,
  open,
  onToggle,
  onView,
  onRemove,
}: {
  d: UploadedDocumentMeta;
  fresh: boolean;
  open: boolean;
  onToggle: () => void;
  onView: () => void;
  onRemove: () => void;
}) {
  const st = STATUS[d.status];
  return (
    <li className={`surface-2 lift rounded-xl ${open ? "border-ion/40 sm:col-span-2" : "hover:border-porcelain/25"} ${fresh ? "anim-confirm" : ""}`}>
      <div className="flex items-start gap-3 px-3 py-2.5">
        <span aria-hidden className="relative mt-0.5 flex h-9 w-7 shrink-0 items-end justify-center rounded-[4px] border border-porcelain/20 bg-porcelain/[0.06] pb-1 font-mono text-[8px] text-porcelain/50">
          PDF
          <span className={`absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border-2 border-navy-2 ${st.dot}`} />
        </span>
        <button type="button" onClick={onToggle} aria-expanded={open} className="min-w-0 flex-1 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-ion">
          <span className="block truncate text-sm" title={d.filename}>
            {d.filename}
          </span>
          <span className={`block text-[11px] ${st.cls}`}>
            {st.label}
            {d.status === "extracted" && <span className="text-porcelain/45"> · {d.pageCount ?? "?"} p.</span>}
          </span>
        </button>
        <button type="button" onClick={onRemove} aria-label={`Remove ${d.filename}`} className="press shrink-0 px-1 text-xs text-porcelain/35 hover:text-coral">
          ✕
        </button>
      </div>
      {open && (
        <div className="anim-fade-up border-t border-porcelain/10 px-3 py-2.5">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] sm:grid-cols-4">
            <div>
              <dt className="text-porcelain/40">Pages</dt>
              <dd>{d.pageCount ?? "Not recorded"}</dd>
            </div>
            <div>
              <dt className="text-porcelain/40">Characters</dt>
              <dd>{d.charCount.toLocaleString()}</dd>
            </div>
            <div>
              <dt className="text-porcelain/40">Size</dt>
              <dd>{kb(d.sizeBytes)}</dd>
            </div>
            <div>
              <dt className="text-porcelain/40">Extraction</dt>
              <dd>{d.extractMs !== undefined ? `${d.extractMs} ms (server)` : "Not recorded"}</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-porcelain/40">Uploaded</dt>
              <dd>{new Date(d.uploadedAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-porcelain/40">Source</dt>
              <dd>{d.origin === "demo" ? "Synthetic demo file" : "Uploaded by you"}</dd>
            </div>
            {d.emptyPages.length > 0 && (
              <div className="col-span-full text-amber">Pages without text: {d.emptyPages.join(", ")}</div>
            )}
            {d.error && <div className="col-span-full text-amber">{d.error}</div>}
          </dl>
          <button
            type="button"
            disabled={d.status === "failed"}
            onClick={onView}
            className="press mt-2 rounded-full border border-ion/40 px-3 py-1 text-[11px] text-ion hover:bg-ion/10 disabled:opacity-30"
          >
            View extracted text
          </button>
        </div>
      )}
    </li>
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
  const [expanded, setExpanded] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const readable = uploads.filter((d) => d.status === "extracted").length;
  const { tasks } = useCaseProgress();

  async function analyseOwn() {
    setError(null);
    if (state.isDemo) await startOwnDossier();
    input.current?.click();
  }
  async function tryDemo() {
    setBusy("Loading sample dossier…");
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
      {/* Mission select: the concept, the principle, and the two ways into a case. */}
      <section className="surface relative overflow-hidden rounded-2xl p-4 sm:p-5">
        <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-ion/10 blur-3xl" />
        <div className="relative grid gap-4 lg:grid-cols-[1.15fr_1fr] lg:items-center">
          <div className="min-w-0">
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-ion">Every dossier is a case</p>
            <p className="mt-1 font-display text-2xl font-semibold sm:text-[1.9rem]">Know what your dossier is <span className="text-ion-grad">missing.</span></p>
            <p className="mt-1 text-sm text-porcelain/60">Every inconsistency is a lead. Every finding must have evidence.</p>
            <ol aria-label="How Evidentra works" className="mt-3 flex flex-wrap items-center gap-1.5 text-[11px]">
              <li className="rounded-full border border-ultra/40 bg-ultra/10 px-2.5 py-1 text-ultra">AI proposes</li>
              <li aria-hidden className="text-porcelain/30">→</li>
              <li className="rounded-full border border-ion/40 bg-ion/10 px-2.5 py-1 text-ion">Software verifies</li>
              <li aria-hidden className="text-porcelain/30">→</li>
              <li className="rounded-full border border-amber/40 bg-amber/10 px-2.5 py-1 text-amber">Humans decide</li>
            </ol>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2" role="group" aria-label="Choose a mission">
            <button
              type="button"
              onClick={analyseOwn}
              className={`lift group rounded-xl border p-3 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-ion ${!state.isDemo ? "border-ion/50 bg-ion/[0.07]" : "border-porcelain/12 bg-navy/50 hover:border-ion/40"}`}
            >
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ion">{!state.isDemo ? "Active case" : "New case"}</span>
              <span className="mt-1 block text-sm font-semibold">Analyse a dossier</span>
              <span className="mt-0.5 block text-[11px] text-porcelain/55">Open an empty case file and upload your own PDFs.</span>
            </button>
            <button
              type="button"
              onClick={tryDemo}
              disabled={Boolean(busy)}
              className={`lift group rounded-xl border border-dashed p-3 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-ion disabled:opacity-60 ${state.isDemo ? "border-porcelain/50 bg-porcelain/[0.06]" : "border-porcelain/25 bg-navy/50 hover:border-porcelain/50"}`}
            >
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-porcelain/70">{state.isDemo ? "Active case · synthetic" : "Synthetic demo case"}</span>
              <span className="mt-1 block text-sm font-semibold">{busy ?? "Explore sample dossier"}</span>
              <span className="mt-0.5 block text-[11px] text-porcelain/55">A fictional pulse oximeter with one planted inconsistency. Reloading resets it.</span>
            </button>
          </div>
        </div>
      </section>
      {error && <p role="alert" className="text-sm text-coral">{error}</p>}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.2fr_1fr] [&>*]:min-w-0">
        {/* Documents */}
        <section aria-labelledby="docs-title" className="surface flex flex-col rounded-2xl p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 id="docs-title" className="font-mono text-[11px] uppercase tracking-[0.2em] text-porcelain/60">
              Evidence intake <span className="text-porcelain/35">{uploads.length}/{MAX_UPLOADS_PER_WORKSPACE}</span>
            </h2>
            {state.isDemo && <span className="rounded-full border border-dashed border-porcelain/40 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.16em] text-porcelain/75">Synthetic demo data</span>}
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
            {u.pending.length > 0 && <span aria-hidden className="anim-scan absolute inset-x-0 top-0 h-px bg-ion shadow-[0_0_12px_2px_rgba(245,181,68,0.6)]" />}
            <span aria-hidden className="text-2xl text-ion">⬡</span>
            <span>
              <span className="block text-sm font-semibold">{u.pending.length ? `Extracting text from ${u.pending.length} file${u.pending.length === 1 ? "" : "s"}…` : "Drop PDFs here or choose files"}</span>
              <span className="block text-xs text-porcelain/50">Text-based PDFs · max 4 MB each · validated and extracted on the server</span>
            </span>
          </button>
          {u.errors.length > 0 && (
            <div role="alert" className="mt-3 rounded-lg border border-coral/40 bg-coral/10 px-3 py-2 text-xs">
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
          <ul className="mt-3 grid min-h-12 flex-1 auto-rows-min grid-cols-1 gap-2 pr-1 sm:grid-cols-2 lg:max-h-[38vh] lg:overflow-auto" aria-label="Documents in this dossier">
            {loading && uploads.length === 0 && <li className="py-2 text-sm text-porcelain/50">Loading documents…</li>}
            {!loading && uploads.length === 0 && u.pending.length === 0 && (
              <li className="col-span-full py-3 text-sm text-porcelain/45">No documents yet. Drop the PDFs of a dossier above, or explore the sample dossier.</li>
            )}
            {uploads.map((d) => (
              <DocCard
                key={d.id}
                d={d}
                fresh={u.justAdded.includes(d.id)}
                open={expanded === d.id}
                onToggle={() => setExpanded(expanded === d.id ? null : d.id)}
                onView={() => setViewing({ id: d.id, filename: d.filename })}
                onRemove={() => u.remove(d.id, d.filename)}
              />
            ))}
            {u.pending.map((name) => (
              <li key={`p-${name}`} className="surface-2 relative overflow-hidden rounded-xl px-3 py-2.5 text-sm">
                <span aria-hidden className="anim-scan absolute inset-x-0 top-0 h-px bg-ion" />
                <div className="truncate">{name}</div>
                <div className="text-[11px] text-ion">Uploading and extracting text…</div>
              </li>
            ))}
          </ul>
        </section>

        {/* Device, pathway, analyse */}
        <div className="flex flex-col gap-4">
          <DevicePathway />
          <section aria-labelledby="analyse-title" className="surface rounded-2xl p-4">
            <h2 id="analyse-title" className="mb-3 font-mono text-[11px] uppercase tracking-[0.2em] text-porcelain/60">
              Scan
            </h2>
            <AnalyzeAction workspaceId={ws} set={CDSCO_MFG_BCD} aiConfigured={results.aiConfigured} readableDocs={readable} hasResults={Boolean(results.analysis)} onDone={refresh} />
            {results.error && <p className="mt-2 text-xs text-coral">{results.error}</p>}
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

      <MissionTasks tasks={tasks} />

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
