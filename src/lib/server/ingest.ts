import { randomUUID } from "node:crypto";
import type { UploadedDocument, UploadedDocumentMeta } from "../uploads";
import { saveDocument, toMeta } from "./document-store";
import { extractPdfPages } from "./pdf-extract";

/** Extract text from an already-validated PDF and store it privately for the workspace. */
export async function ingestPdf(
  workspaceId: string,
  filename: string,
  bytes: Uint8Array,
  origin: "demo" | "user",
): Promise<UploadedDocumentMeta> {
  const t0 = performance.now();
  const result = await extractPdfPages(bytes);
  const extractMs = Math.round(performance.now() - t0);
  const pages = result.ok ? result.pages : [];
  const charCount = pages.reduce((n, p) => n + p.text.replace(/\s/g, "").length, 0);
  const doc: UploadedDocument = {
    id: randomUUID(),
    workspaceId,
    filename,
    sizeBytes: bytes.byteLength,
    uploadedAt: new Date().toISOString(),
    status: !result.ok ? "failed" : charCount < 20 ? "needs_ocr" : "extracted",
    pageCount: result.ok ? result.pageCount : null,
    charCount,
    emptyPages: pages.filter((p) => p.text.length === 0).map((p) => p.page),
    error: result.ok
      ? charCount < 20
        ? "No extractable text was found. This is probably a scanned image; OCR is not supported yet."
        : null
      : result.error,
    origin,
    extractMs,
    pages,
  };
  await saveDocument(doc, bytes);
  return toMeta(doc);
}
