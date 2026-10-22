import { randomUUID } from "node:crypto";
import { listDocuments, saveDocument, toMeta } from "@/lib/server/document-store";
import { extractPdfPages } from "@/lib/server/pdf-extract";
import {
  isSafeId,
  MAX_UPLOAD_BYTES,
  MAX_UPLOADS_PER_WORKSPACE,
  type UploadedDocument,
} from "@/lib/uploads";

const fail = (status: number, error: string) => Response.json({ error }, { status });

/** Keep only a display name: no folders, no control characters. */
function cleanFilename(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "document.pdf";
  return base.replace(/[\u0000-\u001f\u007f]/g, "").slice(0, 200) || "document.pdf";
}

// GET /api/documents?workspaceId=... → metadata only (no page text, no server paths)
export async function GET(request: Request) {
  const workspaceId = new URL(request.url).searchParams.get("workspaceId");
  if (!isSafeId(workspaceId)) return fail(400, "Missing or invalid workspace id.");
  return Response.json({ documents: await listDocuments(workspaceId) });
}

// POST /api/documents (multipart: workspaceId, file) → validate, extract text, store privately
export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return fail(400, "The upload could not be read. Try again with a smaller PDF (max 4 MB).");
  }
  const workspaceId = form.get("workspaceId");
  const file = form.get("file");
  if (typeof workspaceId !== "string" || !isSafeId(workspaceId)) return fail(400, "Missing or invalid workspace id.");
  if (!(file instanceof File)) return fail(400, "No file was received.");

  const filename = cleanFilename(file.name);
  if (!filename.toLowerCase().endsWith(".pdf")) return fail(415, `${filename}: only PDF files are supported.`);
  if (file.size === 0) return fail(400, `${filename}: the file is empty.`);
  if (file.size > MAX_UPLOAD_BYTES) return fail(413, `${filename}: the file is larger than 4 MB.`);

  const existing = await listDocuments(workspaceId);
  if (existing.length >= MAX_UPLOADS_PER_WORKSPACE) {
    return fail(409, `This workspace already has ${MAX_UPLOADS_PER_WORKSPACE} uploads. Remove one first.`);
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  // Real PDFs start with "%PDF-" (allowed within the first 1 KB by the spec).
  const head = new TextDecoder("latin1").decode(bytes.subarray(0, 1024));
  if (!head.includes("%PDF-")) {
    return fail(415, `${filename}: this does not look like a real PDF (it may be renamed or corrupt).`);
  }

  const result = await extractPdfPages(bytes);
  const pages = result.ok ? result.pages : [];
  const charCount = pages.reduce((n, p) => n + p.text.replace(/\s/g, "").length, 0);
  const doc: UploadedDocument = {
    id: randomUUID(),
    workspaceId,
    filename,
    sizeBytes: file.size,
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
    pages,
  };

  try {
    await saveDocument(doc, bytes);
  } catch (err) {
    console.error("[documents] save failed", err);
    return fail(500, `${filename}: the file could not be saved on the server.`);
  }
  return Response.json({ document: toMeta(doc) }, { status: 201 });
}
