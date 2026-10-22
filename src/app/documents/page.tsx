"use client";

import { useRef, useState } from "react";
import { Badge, Button, Card, DemoNotice, PageHeader } from "@/components/ui";
import { actions, useAppState } from "@/lib/store";

const MAX_FILES = 5;
const MAX_BYTES = 4 * 1024 * 1024;

/** Plain-code checks only: extension, size, empty file, and the "%PDF-" signature. */
async function validatePdf(file: File): Promise<string | null> {
  if (!file.name.toLowerCase().endsWith(".pdf")) return "Only PDF files are supported.";
  if (file.size === 0) return "This file is empty.";
  if (file.size > MAX_BYTES) return "This file is larger than 4 MB.";
  const head = new TextDecoder().decode(await file.slice(0, 5).arrayBuffer());
  if (head !== "%PDF-") return "This file does not look like a real PDF (it may be corrupt or renamed).";
  return null;
}

export default function DocumentsPage() {
  const state = useAppState();
  const inputRef = useRef<HTMLInputElement>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const uploads = state.documents.filter((d) => d.source === "upload").length;

  async function onFiles(files: FileList | null) {
    if (!files) return;
    const problems: string[] = [];
    let count = uploads;
    for (const file of Array.from(files)) {
      if (count >= MAX_FILES) {
        problems.push(`${file.name}: limit of ${MAX_FILES} uploaded files reached.`);
        continue;
      }
      const problem = await validatePdf(file);
      if (problem) {
        problems.push(`${file.name}: ${problem}`);
        continue;
      }
      actions.addUpload({
        id: `u-${Date.now()}-${count}`,
        filename: file.name,
        title: "Uploaded document",
        source: "upload",
        pages: null,
        sizeBytes: file.size,
        addedAt: new Date().toISOString(),
        status: "uploaded-not-analysed",
      });
      count++;
    }
    setErrors(problems);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <>
      <PageHeader
        title="Documents"
        subtitle="Up to five readable PDFs (max 4 MB each). Uploads are checked for basic validity here; AI extraction comes in the next build step."
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
            <Button variant="primary" onClick={() => inputRef.current?.click()} disabled={uploads >= MAX_FILES}>
              Upload PDFs
            </Button>
            <Button disabled title="Available once AI extraction is built">
              Analyse with AI
            </Button>
          </>
        }
      />
      {state.isDemo && <DemoNotice>The first five documents below are fictional demo records, not real files.</DemoNotice>}

      {errors.length > 0 && (
        <div role="alert" className="mb-4 rounded-md border border-bad/30 bg-bad-soft px-4 py-3 text-sm text-bad">
          <div className="font-medium">Some files could not be added. Nothing was extracted or invented.</div>
          <ul className="mt-1 list-disc pl-5">
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
          <button type="button" className="mt-2 underline" onClick={() => inputRef.current?.click()}>
            Choose files again
          </button>
        </div>
      )}

      <Card>
        {state.documents.length === 0 ? (
          <p className="text-sm text-ink-soft">No documents yet. Upload PDFs, or reload the demo from the Workspace page.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-line text-xs uppercase tracking-wide text-mute">
                  <th className="py-2 pr-4 font-medium">File</th>
                  <th className="py-2 pr-4 font-medium">Origin</th>
                  <th className="py-2 pr-4 font-medium">Pages</th>
                  <th className="py-2 pr-4 font-medium">Status</th>
                  <th className="py-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {state.documents.map((d) => (
                  <tr key={d.id} className="border-b border-line/60 last:border-0">
                    <td className="py-3 pr-4">
                      <div className="font-medium text-ink">{d.filename}</div>
                      <div className="text-xs text-mute">
                        {d.title}
                        {d.sizeBytes ? ` · ${(d.sizeBytes / 1024).toFixed(0)} KB` : ""}
                      </div>
                    </td>
                    <td className="py-3 pr-4">
                      {d.source === "demo" ? <Badge tone="demo">Fictional demo</Badge> : <Badge tone="teal">Your upload</Badge>}
                    </td>
                    <td className="py-3 pr-4 text-ink-soft">{d.pages ?? "—"}</td>
                    <td className="py-3 pr-4 text-ink-soft">
                      {d.status === "demo-seeded" ? "Demo facts pre-loaded" : "Uploaded — not analysed yet"}
                    </td>
                    <td className="py-3 text-right">
                      <Button variant="danger" onClick={() => actions.removeDocument(d.id)}>
                        Remove
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <p className="mt-3 text-xs text-mute">
        File contents are not stored or sent anywhere in this build. Only the file name and size are kept in this browser.
      </p>
    </>
  );
}
