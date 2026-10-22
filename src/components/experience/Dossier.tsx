"use client";

import { useRef, useState } from "react";
import { categoryLabel } from "@/lib/analysis";
import { refreshShared, useShared } from "@/lib/shared-fetch";
import { actions } from "@/lib/store";
import { useGapReport } from "@/lib/use-report";
import { MAX_UPLOAD_BYTES, MAX_UPLOADS_PER_WORKSPACE, type UploadedDocument } from "@/lib/uploads";
import { AnalyzeAction } from "../AnalyzeAction";
import { Drawer } from "../ui";
import { ChapterHead } from "./Chapter";
import { Reveal } from "./Reveal";

const STATUS = {
  extracted: { label: "Text extracted", cls: "text-ion", dot: "bg-ion" },
  needs_ocr: { label: "No readable text — looks like a scan. Upload a text-based PDF.", cls: "text-lime", dot: "bg-lime" },
  failed: { label: "Could not be read — re-export it as a normal PDF without a password.", cls: "text-crimson", dot: "bg-crimson" },
} as const;

function precheck(file: File): string | null {
  if (!file.name.toLowerCase().endsWith(".pdf")) return "only PDF files are supported.";
  if (file.size === 0) return "the file is empty.";
  if (file.size > MAX_UPLOAD_BYTES) return "the file is larger than 4 MB.";
  return null;
}

/** The real extracted text, page by page, opened at the cited page. */
function DocumentText({ workspaceId, id, page }: { workspaceId: string; id: string; page: number | null }) {
  const e = useShared(`doc:${workspaceId}:${id}`, async () => {
    const res = await fetch(`/api/documents/${id}?workspaceId=${encodeURIComponent(workspaceId)}`);
    const j = await res.json();
    if (!res.ok) throw new Error(j.error ?? "Could not load the text.");
    return j.document as UploadedDocument;
  });
  if (e.error) return <p className="text-sm text-bad">{e.error}</p>;
  if (!e.data) return <p className="text-sm text-mute">Loading text…</p>;
  return (
    <div className="space-y-5">
      <p className="text-xs text-mute">Raw text as read from the PDF. Layout, tables and images are not preserved.</p>
      {e.data.pages.map((p) => (
        <section
          key={p.page}
          ref={(el) => {
            if (el && page === p.page) el.scrollIntoView({ block: "start" });
          }}
          className={`rounded-lg ${page === p.page ? "ring-2 ring-teal/40" : ""}`}
        >
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-teal-dark">Page {p.page}</h3>
          {p.text ? (
            <pre className="whitespace-pre-wrap break-words rounded-lg bg-background p-3 font-mono text-xs leading-relaxed text-ink">{p.text}</pre>
          ) : (
            <p className="rounded-lg bg-warn-soft p-3 text-xs text-warn">No readable text on this page.</p>
          )}
        </section>
      ))}
    </div>
  );
}

/** Feature 1 — Dossier Intelligence: upload, extract, and trace evidence to its passage. */
export function Dossier() {
  const { state, set, report, results, uploads: up, loading, refresh } = useGapReport();
  const uploads = up.uploads;
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<string[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [justAdded, setJustAdded] = useState<string[]>([]);
  const [drag, setDrag] = useState(false);
  const [viewing, setViewing] = useState<{ filename: string; page: number | null } | null>(null);
  const [showAll, setShowAll] = useState(false);

  const slotsLeft = MAX_UPLOADS_PER_WORKSPACE - uploads.length - pending.length;
  const readable = uploads.filter((u) => u.status === "extracted").length;
  const viewDoc = viewing ? uploads.find((u) => u.filename === viewing.filename) : null;
  const facts = report.analysis?.items.filter((i) => i.kind === "fact") ?? [];
  const isSeed = report.analysis?.source === "demo-seed";
  const byDoc = [...new Set(facts.map((f) => f.citations[0]?.filename).filter(Boolean) as string[])].map((filename) => ({
    filename,
    facts: facts.filter((f) => f.citations[0]?.filename === filename),
  }));

  async function onFiles(list: FileList | null) {
    if (!list || list.length === 0) return;
    const files = Array.from(list);
    if (inputRef.current) inputRef.current.value = "";
    const problems: string[] = [];
    let room = slotsLeft;
    for (const file of files) {
      const problem = room <= 0 ? `limit of ${MAX_UPLOADS_PER_WORKSPACE} documents reached.` : precheck(file);
      if (problem) {
        problems.push(`${file.name}: ${problem}`);
        continue;
      }
      room--;
      setPending((p) => [...p, file.name]);
      try {
        const body = new FormData();
        body.append("workspaceId", state.workspaceId);
        body.append("file", file);
        const res = await fetch("/api/documents", { method: "POST", body });
        const j = await res.json().catch(() => ({}));
        if (!res.ok) problems.push(j.error ?? `${file.name}: upload failed (HTTP ${res.status}).`);
        else if (j.document?.id) setJustAdded((x) => [...x, j.document.id]);
      } catch {
        problems.push(`${file.name}: could not reach the server. Try again.`);
      } finally {
        setPending((p) => p.filter((n) => n !== file.name));
        refresh();
      }
    }
    setErrors(problems);
  }

  async function remove(id: string, filename: string) {
    if (!window.confirm(`Remove ${filename} from this dossier?`)) return;
    const res = await fetch(`/api/documents/${id}?workspaceId=${encodeURIComponent(state.workspaceId)}`, { method: "DELETE" }).catch(() => null);
    if (!res || !res.ok) setErrors(["The document could not be removed. Try again."]);
    refresh();
  }

  return (
    <section id="dossier" className="stage sci-grid print-hide overflow-hidden px-5 py-28">
      <div aria-hidden className="glow-ion pointer-events-none absolute -right-40 top-20 h-[30rem] w-[30rem] opacity-60" />
      <div className="relative mx-auto max-w-6xl">
        <ChapterHead
          n="01"
          name="Dossier Intelligence"
          title={
            <>
              Upload. Extract.
              <br />
              <span className="text-ion-grad">Trace every passage.</span>
            </>
          }
          lead="Bring your regulatory PDFs together. Evidentra reads the actual text and links every piece of evidence back to its page."
        />

        {state.isDemo && (
          <Reveal className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-lime/40 bg-lime/5 px-4 py-3 text-sm">
            <span>
              <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-lime">Synthetic demo data</span>
              <span className="ml-3 text-porcelain/75">Fictional documents for a made-up device. Not real findings.</span>
            </span>
            <button
              type="button"
              onClick={async () => {
                actions.startBlank();
                await refreshShared("");
              }}
              className="press rounded-full border hairline px-4 py-1.5 text-xs text-porcelain hover:border-porcelain/50"
            >
              Start your own dossier
            </button>
          </Reveal>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.1fr_1fr] [&>*]:min-w-0">
          {/* Upload + document list */}
          <Reveal className="panel rounded-2xl p-5 sm:p-6">
            <input ref={inputRef} type="file" accept="application/pdf,.pdf" multiple className="hidden" onChange={(e) => onFiles(e.target.files)} />
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={slotsLeft <= 0 || pending.length > 0}
              onDragOver={(e) => {
                e.preventDefault();
                setDrag(true);
              }}
              onDragLeave={() => setDrag(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDrag(false);
                onFiles(e.dataTransfer.files);
              }}
              className={`press group relative flex w-full flex-col items-center justify-center overflow-hidden rounded-xl border border-dashed px-6 py-10 text-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ion disabled:cursor-not-allowed disabled:opacity-60 ${
                drag ? "border-ion bg-ion/10" : "border-porcelain/25 hover:border-ion/70 hover:bg-ion/5"
              }`}
            >
              {pending.length > 0 && <span aria-hidden className="anim-scan absolute inset-x-0 top-0 h-px bg-ion shadow-[0_0_14px_2px_rgba(57,231,255,0.6)]" />}
              <span aria-hidden className="mb-3 text-3xl text-ion">⬡</span>
              <span className="text-base font-semibold">{pending.length > 0 ? "Extracting text…" : "Drop PDFs here or choose files"}</span>
              <span className="mt-1 text-xs text-porcelain/55">
                Readable PDFs · up to 4 MB each · {MAX_UPLOADS_PER_WORKSPACE} per dossier · stored privately
              </span>
            </button>

            {errors.length > 0 && (
              <div role="alert" className="mt-4 rounded-lg border border-crimson/40 bg-crimson/10 px-4 py-3 text-sm">
                <div className="font-medium text-crimson">Some files were not added. Nothing was extracted from them.</div>
                <ul className="mt-1 list-disc pl-5 text-porcelain/80">
                  {errors.map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
                <button type="button" onClick={() => setErrors([])} className="mt-2 text-xs underline">
                  Dismiss
                </button>
              </div>
            )}

            <ul className="mt-5 divide-y divide-porcelain/10" aria-label="Documents in this dossier">
              {loading && <li className="py-3 text-sm text-porcelain/50">Loading documents…</li>}
              {!loading && uploads.length === 0 && pending.length === 0 && (
                <li className="py-3 text-sm text-porcelain/50">No documents yet.</li>
              )}
              {uploads.map((d) => {
                const st = STATUS[d.status];
                return (
                  <li key={d.id} className={`flex items-start gap-3 rounded-md py-3 ${justAdded.includes(d.id) ? "anim-confirm" : ""}`}>
                    <span aria-hidden className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${st.dot}`} />
                    <div className="min-w-0 flex-1">
                      <div className="break-all text-sm font-medium">{d.filename}</div>
                      <div className={`text-xs ${st.cls}`}>
                        {st.label}
                        {d.status === "extracted" && <span className="text-porcelain/50"> · {d.pageCount} page{d.pageCount === 1 ? "" : "s"}</span>}
                        {justAdded.includes(d.id) && d.status === "extracted" && <span className="anim-status ml-2 inline-block text-ion">✓ processed</span>}
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <button
                        type="button"
                        disabled={d.status === "failed"}
                        onClick={() => setViewing({ filename: d.filename, page: null })}
                        className="press rounded-full border hairline px-3 py-1 text-xs hover:border-ion/60 disabled:opacity-30"
                      >
                        View text
                      </button>
                      <button
                        type="button"
                        onClick={() => remove(d.id, d.filename)}
                        aria-label={`Remove ${d.filename}`}
                        className="press rounded-full px-2 py-1 text-xs text-porcelain/50 hover:text-crimson"
                      >
                        ✕
                      </button>
                    </div>
                  </li>
                );
              })}
              {pending.map((name) => (
                <li key={`p-${name}`} className="flex items-center gap-3 py-3 text-sm">
                  <span aria-hidden className="anim-pulse h-2 w-2 rounded-full bg-ion" />
                  <span className="min-w-0 flex-1 break-all">{name}</span>
                  <span className="text-xs text-ion">Extracting text…</span>
                </li>
              ))}
            </ul>
          </Reveal>

          {/* Analysis */}
          <Reveal delay={120} className="panel rounded-2xl p-5 sm:p-6">
            <h3 className="text-lg font-semibold">Analyse the dossier</h3>
            <p className="mt-1 text-sm text-porcelain/60">
              One run reads every readable document, checks them against each other and matches regulatory evidence. Every quotation is
              checked against the real text.
            </p>
            <div className="mt-5">
              <AnalyzeAction
                workspaceId={state.workspaceId}
                set={set}
                aiConfigured={results.aiConfigured}
                readableDocs={readable}
                hasResults={Boolean(report.analysis || report.mapping)}
                onDone={refresh}
              />
            </div>
            {results.error && <p className="mt-3 text-sm text-crimson">{results.error}</p>}
          </Reveal>
        </div>

        {/* Extracted evidence */}
        <Reveal className="mt-16">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h3 className="text-2xl font-bold tracking-tight">Extracted evidence</h3>
              <p className="mt-1 text-sm text-porcelain/60">
                <span className="text-ion">Quoted text</span> is copied from the document and verified by code.{" "}
                <span className="text-ultra">Field names and values</span> are {isSeed ? "hand-written demo labels" : "AI suggestions"} until you review them.
              </p>
            </div>
            {isSeed && <span className="rounded-full border border-lime/60 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.2em] text-lime">Synthetic demo data</span>}
          </div>
          {!report.analysis ? (
            <p className="panel rounded-2xl px-5 py-6 text-sm text-porcelain/55">Analyse the dossier to see evidence traced to its pages.</p>
          ) : facts.length === 0 ? (
            <p className="panel rounded-2xl px-5 py-6 text-sm text-porcelain/55">No evidence passages were identified in the analysed text.</p>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 [&>*]:min-w-0">
              {byDoc.map((g, gi) => (
                <Reveal key={g.filename} delay={gi * 80} className="panel rounded-2xl p-5">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="min-w-0 break-all font-mono text-xs uppercase tracking-[0.12em] text-porcelain/70">{g.filename}</div>
                    <span className="shrink-0 text-xs text-porcelain/40">{g.facts.length}</span>
                  </div>
                  <ul className="space-y-3">
                    {(showAll ? g.facts : g.facts.slice(0, 5)).map((f) => {
                      const c = f.citations[0];
                      return (
                        <li key={f.id} className="border-l border-porcelain/15 pl-3">
                          <div className="text-[11px] uppercase tracking-[0.14em] text-ultra">
                            {f.field} <span className="text-porcelain/30">· {categoryLabel(f.category)}</span>
                          </div>
                          <div className="text-sm font-medium">{f.value}</div>
                          {c && (
                            <button
                              type="button"
                              onClick={() => setViewing({ filename: c.filename, page: c.verifiedPage ?? c.claimedPage })}
                              className="press mt-1 block text-left text-xs focus:outline-none focus-visible:ring-1 focus-visible:ring-ion"
                            >
                              <span className="italic text-porcelain/75">“{c.quote}”</span>{" "}
                              {c.verifiedPage !== null ? (
                                <span className="whitespace-nowrap text-ion">✓ p.{c.verifiedPage}</span>
                              ) : (
                                <span className="text-crimson">✕ quote not found in the text — do not rely on it</span>
                              )}
                            </button>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </Reveal>
              ))}
            </div>
          )}
          {facts.length > 0 && byDoc.some((g) => g.facts.length > 5) && (
            <button type="button" onClick={() => setShowAll((v) => !v)} className="press mt-4 text-sm text-ion underline-offset-4 hover:underline">
              {showAll ? "Show fewer" : "Show all evidence"}
            </button>
          )}
        </Reveal>
      </div>

      <Drawer open={Boolean(viewing)} onClose={() => setViewing(null)} eyebrow="Extracted text" title={viewing?.filename ?? ""}>
        {viewDoc ? (
          <DocumentText workspaceId={state.workspaceId} id={viewDoc.id} page={viewing?.page ?? null} />
        ) : (
          <p className="text-sm text-mute">This document is not in the current dossier.</p>
        )}
      </Drawer>
    </section>
  );
}
