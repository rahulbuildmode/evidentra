"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { LoadDemoButton } from "@/components/evidence";
import { Button, Card, Drawer, EmptyState, Notice, PageHeader, Stat, StatusDot, type Tone } from "@/components/ui";
import { setQueryParam, useQueryParam } from "@/lib/use-query";
import { refreshShared, useShared } from "@/lib/shared-fetch";
import { useGapReport } from "@/lib/use-report";
import { MAX_UPLOAD_BYTES, MAX_UPLOADS_PER_WORKSPACE, type UploadedDocument, type UploadStatus } from "@/lib/uploads";

const STATUS: Record<UploadStatus, { label: string; tone: Tone; next?: string }> = {
  extracted: { label: "Text extracted", tone: "teal" },
  needs_ocr: {
    label: "No readable text",
    tone: "warn",
    next: "This looks like a scanned image. Upload a text-based PDF (export it from Word or the original software) so it can be read.",
  },
  failed: {
    label: "Could not be read",
    tone: "bad",
    next: "The file may be damaged or password-protected. Re-export it as a normal PDF, remove any password, and upload it again.",
  },
};

/** Quick checks in the browser; the server repeats them (and checks the PDF signature) before storing. */
function precheck(file: File): string | null {
  if (!file.name.toLowerCase().endsWith(".pdf")) return "only PDF files are supported.";
  if (file.size === 0) return "the file is empty.";
  if (file.size > MAX_UPLOAD_BYTES) return "the file is larger than 4 MB.";
  return null;
}

const kb = (n: number) => `${Math.max(1, Math.round(n / 1024))} KB`;

/** Extracted text for one document, one block per PDF page, scrolled to `page` if given. */
function DocumentText({ workspaceId, id, page }: { workspaceId: string; id: string; page: number | null }) {
  const e = useShared(`doc:${workspaceId}:${id}`, async () => {
    const res = await fetch(`/api/documents/${id}?workspaceId=${encodeURIComponent(workspaceId)}`);
    const j = await res.json();
    if (!res.ok) throw new Error(j.error ?? "Could not load the text.");
    return j.document as UploadedDocument;
  });
  const doc = e.data;
  useEffect(() => {
    if (doc && page) document.getElementById(`doc-page-${page}`)?.scrollIntoView({ block: "start" });
  }, [doc, page]);
  if (e.error) return <Notice tone="bad">{e.error}</Notice>;
  if (!doc) return <p className="text-sm text-mute">Loading text…</p>;
  return (
    <div className="space-y-5">
      <p className="text-xs text-mute">Raw text as read from the PDF. Layout, tables and images are not preserved.</p>
      {doc.pages.map((p) => (
        <section key={p.page} id={`doc-page-${p.page}`} className={`scroll-mt-4 rounded-lg ${page === p.page ? "ring-2 ring-teal/40" : ""}`}>
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-teal-dark">Page {p.page}</h3>
          {p.text ? (
            <pre className="whitespace-pre-wrap break-words rounded-lg bg-background p-3 font-mono text-xs leading-relaxed text-ink">{p.text}</pre>
          ) : (
            <p className="rounded-lg bg-warn-soft p-3 text-xs text-warn">No readable text on this page (it may be a scanned image).</p>
          )}
        </section>
      ))}
    </div>
  );
}

export default function DocumentsPage() {
  const { state, report, uploads: up, loading } = useGapReport();
  const { uploads, error: listError, refresh } = up;
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<string[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const viewName = useQueryParam("view");
  const pageParam = Number(useQueryParam("page")) || null;
  const viewing = viewName ? uploads.find((u) => u.filename === viewName) ?? null : null;

  const slotsLeft = MAX_UPLOADS_PER_WORKSPACE - uploads.length - pending.length;
  const processed = uploads.filter((u) => u.status === "extracted").length;
  const attention = uploads.length - processed;

  // How many report items cite each file (requirements and findings).
  const citedBy = (filename: string) =>
    [...report.requirements, ...report.findings].filter((x) => !x.dismissed && x.citations.some((c) => c.filename === filename)).length;

  async function onFiles(list: FileList | null) {
    if (!list || list.length === 0) return;
    const files = Array.from(list);
    if (inputRef.current) inputRef.current.value = "";
    const problems: string[] = [];
    let room = slotsLeft;
    // Upload one at a time: each request stays small and the status shown is real.
    for (const file of files) {
      const problem = room <= 0 ? `upload limit of ${MAX_UPLOADS_PER_WORKSPACE} reached.` : precheck(file);
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
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          problems.push(j.error ?? `${file.name}: upload failed (HTTP ${res.status}).`);
        }
      } catch {
        problems.push(`${file.name}: could not reach the server. Check that the app is running and try again.`);
      } finally {
        setPending((p) => p.filter((n) => n !== file.name));
        refresh();
      }
    }
    setErrors(problems);
  }

  async function remove(id: string, filename: string) {
    if (!window.confirm(`Remove ${filename} from this workspace?`)) return;
    const res = await fetch(`/api/documents/${id}?workspaceId=${encodeURIComponent(state.workspaceId)}`, { method: "DELETE" }).catch(() => null);
    if (!res || !res.ok) setErrors(["The document could not be removed. Try again."]);
    if (viewing?.id === id) setQueryParam("view", null);
    refresh();
  }

  return (
    <>
      <PageHeader
        title="Documents"
        subtitle={`Readable PDFs, up to 4 MB each and ${MAX_UPLOADS_PER_WORKSPACE} per workspace. Stored privately for this workspace.`}
        actions={
          <>
            <input ref={inputRef} type="file" accept="application/pdf,.pdf" multiple className="hidden" onChange={(e) => onFiles(e.target.files)} />
            <Button variant="primary" onClick={() => inputRef.current?.click()} disabled={slotsLeft <= 0 || pending.length > 0}>
              {pending.length > 0 ? "Uploading…" : "Upload PDFs"}
            </Button>
          </>
        }
      />

      {errors.length > 0 && (
        <div className="mb-4">
          <Notice tone="bad" role="alert">
            <div className="font-medium">Some files were not added. Nothing was extracted from them.</div>
            <ul className="mt-1 list-disc pl-5">
              {errors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
            <div className="mt-2 flex gap-3">
              <button type="button" className="underline" onClick={() => inputRef.current?.click()}>
                Choose files again
              </button>
              <button type="button" className="underline" onClick={() => setErrors([])}>
                Dismiss
              </button>
            </div>
          </Notice>
        </div>
      )}
      {listError && (
        <div className="mb-4">
          <Notice tone="bad" role="alert">
            {listError}{" "}
            <button type="button" className="underline" onClick={refresh}>
              Retry
            </button>
          </Notice>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-mute">Loading documents…</p>
      ) : uploads.length === 0 && pending.length === 0 ? (
        <EmptyState title="No documents yet">
          Upload the device master file, instructions for use, risk summary and certificates as PDFs.
          {state.isDemo && (
            <div className="mt-3">
              <LoadDemoButton onLoaded={() => refreshAll(refresh)} />
            </div>
          )}
        </EmptyState>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap gap-8 rounded-xl border border-line bg-white px-5 py-4">
            <Stat label="Documents" value={uploads.length} />
            <Stat label="Text extracted" value={processed} tone={processed ? "teal" : "neutral"} />
            <Stat label="Need attention" value={attention} tone={attention ? "warn" : "neutral"} />
          </div>

          <Card className="p-0!">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm sm:min-w-[640px]">
                <thead>
                  <tr className="border-b border-line text-xs text-mute">
                    <th className="px-5 py-2.5 font-medium">Document</th>
                    <th className="px-3 py-2.5 font-medium">Status</th>
                    <th className="hidden px-3 py-2.5 font-medium sm:table-cell">Pages</th>
                    <th className="hidden px-3 py-2.5 font-medium sm:table-cell">Cited in</th>
                    <th className="hidden px-3 py-2.5 font-medium sm:table-cell">Processed</th>
                    <th className="px-5 py-2.5 font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {uploads.map((d) => {
                    const st = STATUS[d.status];
                    const n = citedBy(d.filename);
                    return (
                      <tr key={d.id} className="border-b border-line/60 align-top last:border-0">
                        <td className="px-5 py-3">
                          <div className="break-all font-medium text-ink">{d.filename}</div>
                          <div className="text-xs text-mute">
                            {kb(d.sizeBytes)}
                            {d.origin === "demo" && <span className="text-demo"> · demo file</span>}
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <StatusDot tone={st.tone}>{st.label}</StatusDot>
                          {st.next && <p className="mt-1 max-w-xs text-xs text-ink-soft">{st.next}</p>}
                          {d.status === "extracted" && d.emptyPages.length > 0 && (
                            <p className="mt-1 max-w-xs text-xs text-warn">Page {d.emptyPages.join(", ")} had no readable text.</p>
                          )}
                        </td>
                        <td className="hidden px-3 py-3 tabular-nums text-ink-soft sm:table-cell">{d.pageCount ?? "—"}</td>
                        <td className="hidden px-3 py-3 text-ink-soft sm:table-cell">
                          {n ? (
                            <Link href="/readiness-report#details" className="text-teal-dark hover:underline">
                              {n} item{n === 1 ? "" : "s"}
                            </Link>
                          ) : (
                            <span className="text-mute">—</span>
                          )}
                        </td>
                        <td className="hidden whitespace-nowrap px-3 py-3 text-xs text-mute sm:table-cell">{new Date(d.uploadedAt).toLocaleString()}</td>
                        <td className="px-5 py-3">
                          <div className="flex flex-col items-end gap-1 sm:flex-row sm:justify-end">
                            <Button size="sm" disabled={d.status === "failed"} onClick={() => setQueryParam("view", d.filename)}>
                              View text
                            </Button>
                            <Button size="sm" variant="ghost" className="text-bad! hover:bg-bad-soft!" onClick={() => remove(d.id, d.filename)}>
                              Remove
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {pending.map((name) => (
                    <tr key={`pending-${name}`} className="border-b border-line/60 last:border-0">
                      <td className="px-5 py-3 font-medium text-ink">{name}</td>
                      <td className="px-3 py-3" colSpan={5}>
                        <span className="inline-flex items-center gap-2 text-ink-soft">
                          <span className="h-3 w-3 animate-spin rounded-full border-2 border-teal border-t-transparent" />
                          Uploading and extracting text…
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
          {processed > 0 && !report.analysis && (
            <p className="mt-4 text-sm text-ink-soft">
              Next: <Link href="/" className="font-medium text-teal-dark hover:underline">analyze the documents</Link> to find gaps and mismatches.
            </p>
          )}
        </>
      )}

      <p className="mt-6 text-xs text-mute">
        Files are stored on the server running this app, outside the public web folder, and are only returned through this workspace.
        There are no user accounts yet, so use fictional or non-confidential documents in this prototype.
      </p>

      <Drawer
        open={Boolean(viewName)}
        onClose={() => {
          setQueryParam("view", null);
          setQueryParam("page", null);
        }}
        eyebrow="Extracted text"
        title={viewName ?? ""}
      >
        {viewing ? (
          <DocumentText workspaceId={state.workspaceId} id={viewing.id} page={pageParam} />
        ) : loading ? (
          <p className="text-sm text-mute">Loading…</p>
        ) : (
          <Notice tone="warn">This document is not in the current workspace.</Notice>
        )}
      </Drawer>
    </>
  );
}

function refreshAll(refresh: () => void) {
  refresh();
  refreshShared("");
}
