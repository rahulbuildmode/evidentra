"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { Badge, Button, Card, DemoNotice, PageHeader } from "@/components/ui";
import { actions, useAppState } from "@/lib/store";
import { useUploads } from "@/lib/use-uploads";
import {
  MAX_UPLOAD_BYTES,
  MAX_UPLOADS_PER_WORKSPACE,
  STATUS_LABEL,
  type UploadedDocument,
  type UploadStatus,
} from "@/lib/uploads";

const STATUS_TONE: Record<UploadStatus, "teal" | "warn" | "bad"> = {
  extracted: "teal",
  needs_ocr: "warn",
  failed: "bad",
};

/** Quick checks in the browser; the server repeats them (and checks the PDF signature) before storing. */
function precheck(file: File): string | null {
  if (!file.name.toLowerCase().endsWith(".pdf")) return "only PDF files are supported.";
  if (file.size === 0) return "the file is empty.";
  if (file.size > MAX_UPLOAD_BYTES) return "the file is larger than 4 MB.";
  return null;
}

function kb(n: number) {
  return `${Math.max(1, Math.round(n / 1024))} KB`;
}

export default function DocumentsPage() {
  const state = useAppState();
  const { uploads, loading, error: listError, refresh } = useUploads(state.workspaceId);
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<string[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [viewer, setViewer] = useState<
    { id: string; doc: UploadedDocument | null; error: string | null } | null
  >(null);

  const demoDocs = state.documents.filter((d) => d.source === "demo");
  const slotsLeft = MAX_UPLOADS_PER_WORKSPACE - uploads.length - pending.length;

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

  async function openViewer(id: string) {
    setViewer({ id, doc: null, error: null });
    try {
      const res = await fetch(`/api/documents/${id}?workspaceId=${encodeURIComponent(state.workspaceId)}`);
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Could not load the text.");
      setViewer({ id, doc: j.document, error: null });
    } catch (e) {
      setViewer({ id, doc: null, error: (e as Error).message });
    }
  }

  async function remove(id: string) {
    const res = await fetch(`/api/documents/${id}?workspaceId=${encodeURIComponent(state.workspaceId)}`, {
      method: "DELETE",
    }).catch(() => null);
    if (!res || !res.ok) setErrors(["The document could not be removed. Try again."]);
    if (viewer?.id === id) setViewer(null);
    refresh();
  }

  return (
    <>
      <PageHeader
        title="Documents"
        subtitle={`Upload readable PDFs (max 4 MB each, ${MAX_UPLOADS_PER_WORKSPACE} per workspace). Text is extracted page by page on the server and stored privately for this workspace.`}
        actions={
          <>
            <input
              ref={inputRef}
              type="file"
              accept="application/pdf,.pdf"
              multiple
              className="hidden"
              onChange={(e) => onFiles(e.target.files)}
            />
            <Button variant="primary" onClick={() => inputRef.current?.click()} disabled={slotsLeft <= 0 || pending.length > 0}>
              {pending.length > 0 ? "Uploading…" : "Upload PDFs"}
            </Button>
            <Link
              href="/consistency-checks#ai"
              className="inline-flex items-center justify-center whitespace-nowrap rounded-md border border-line bg-white px-3 py-2 text-sm font-medium text-ink hover:bg-background"
            >
              Analyse with AI →
            </Link>
          </>
        }
      />
      {state.isDemo && (
        <DemoNotice>
          Rows marked &quot;Fictional demo&quot; are made-up records with no file behind them. Your uploads are real files and
          are marked &quot;Your upload&quot;.
        </DemoNotice>
      )}

      {errors.length > 0 && (
        <div role="alert" className="mb-4 rounded-md border border-bad/30 bg-bad-soft px-4 py-3 text-sm text-bad">
          <div className="font-medium">Some files were not added. No text or facts were created for them.</div>
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
        </div>
      )}
      {listError && (
        <div role="alert" className="mb-4 rounded-md border border-bad/30 bg-bad-soft px-4 py-3 text-sm text-bad">
          {listError}{" "}
          <button type="button" className="underline" onClick={refresh}>
            Retry
          </button>
        </div>
      )}

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-line text-xs uppercase tracking-wide text-mute">
                <th className="py-2 pr-4 font-medium">File</th>
                <th className="py-2 pr-4 font-medium">Origin</th>
                <th className="py-2 pr-4 font-medium">Status</th>
                <th className="py-2 pr-4 font-medium">Pages</th>
                <th className="py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {uploads.map((d) => (
                <tr key={d.id} className="border-b border-line/60 align-top last:border-0">
                  <td className="py-3 pr-4">
                    <div className="break-all font-medium text-ink">{d.filename}</div>
                    <div className="text-xs text-mute">
                      {kb(d.sizeBytes)} · {d.charCount.toLocaleString()} characters
                    </div>
                  </td>
                  <td className="py-3 pr-4">
                    <Badge tone="teal">Your upload</Badge>
                  </td>
                  <td className="py-3 pr-4">
                    <Badge tone={STATUS_TONE[d.status]}>{STATUS_LABEL[d.status]}</Badge>
                    {d.error && <div className="mt-1 max-w-xs text-xs text-ink-soft">{d.error}</div>}
                    {d.status === "extracted" && d.emptyPages.length > 0 && (
                      <div className="mt-1 max-w-xs text-xs text-warn">
                        No text on page {d.emptyPages.join(", ")} (may need OCR).
                      </div>
                    )}
                  </td>
                  <td className="py-3 pr-4 text-ink-soft">{d.pageCount ?? "—"}</td>
                  <td className="py-3">
                    <div className="flex justify-end gap-2">
                      <Button onClick={() => openViewer(d.id)} disabled={d.status === "failed"}>
                        View text
                      </Button>
                      <Button variant="danger" onClick={() => remove(d.id)}>
                        Remove
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {pending.map((name) => (
                <tr key={`pending-${name}`} className="border-b border-line/60 last:border-0">
                  <td className="py-3 pr-4 font-medium text-ink">{name}</td>
                  <td className="py-3 pr-4">
                    <Badge tone="teal">Your upload</Badge>
                  </td>
                  <td className="py-3 pr-4" colSpan={3}>
                    <span className="inline-flex items-center gap-2 text-ink-soft">
                      <span className="h-3 w-3 animate-spin rounded-full border-2 border-teal border-t-transparent" />
                      Uploading and extracting text…
                    </span>
                  </td>
                </tr>
              ))}
              {demoDocs.map((d) => (
                <tr key={d.id} className="border-b border-line/60 align-top last:border-0">
                  <td className="py-3 pr-4">
                    <div className="font-medium text-ink">{d.filename}</div>
                    <div className="text-xs text-mute">{d.title}</div>
                  </td>
                  <td className="py-3 pr-4">
                    <Badge tone="demo">Fictional demo</Badge>
                  </td>
                  <td className="py-3 pr-4 text-xs text-ink-soft">Demo facts pre-loaded (no real file)</td>
                  <td className="py-3 pr-4 text-ink-soft">{d.pages ?? "—"}</td>
                  <td className="py-3">
                    <div className="flex justify-end gap-2">
                      <Button disabled title="Demo records have no file">
                        View text
                      </Button>
                      <Button variant="danger" onClick={() => actions.removeDocument(d.id)}>
                        Remove
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && uploads.length === 0 && pending.length === 0 && demoDocs.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-sm text-ink-soft">
                    No documents yet. Upload PDFs to get started.
                  </td>
                </tr>
              )}
              {loading && (
                <tr>
                  <td colSpan={5} className="py-4 text-sm text-mute">
                    Loading uploads…
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {viewer && (
        <Card className="mt-4" title={viewer.doc ? `Extracted text — ${viewer.doc.filename}` : "Extracted text"}>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-mute">
              Raw text as read from the PDF, one block per PDF page. Layout, tables and images are not preserved.
            </p>
            <Button onClick={() => setViewer(null)}>Close</Button>
          </div>
          {!viewer.doc && !viewer.error && <p className="text-sm text-mute">Loading text…</p>}
          {viewer.error && <p className="text-sm text-bad">{viewer.error}</p>}
          {viewer.doc && (
            <div className="max-h-[32rem] space-y-4 overflow-y-auto pr-1">
              {viewer.doc.pages.map((p) => (
                <section key={p.page}>
                  <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-teal">PDF page {p.page}</h3>
                  {p.text ? (
                    <pre className="whitespace-pre-wrap break-words rounded-md bg-background p-3 font-mono text-xs leading-relaxed text-ink">
                      {p.text}
                    </pre>
                  ) : (
                    <p className="rounded-md bg-warn-soft p-3 text-xs text-warn">
                      No extractable text on this page (it may be a scanned image).
                    </p>
                  )}
                </section>
              ))}
            </div>
          )}
        </Card>
      )}

      <p className="mt-3 text-xs text-mute">
        Uploaded files are stored on the server running this app, outside the public web folder, and are only returned
        through this workspace. There are no user accounts yet, so anyone who can reach this server and knows the
        workspace id could request them. Use fictional or non-confidential documents in this prototype.
      </p>
    </>
  );
}
