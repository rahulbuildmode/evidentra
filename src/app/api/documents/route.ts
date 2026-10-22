import { listDocuments } from "@/lib/server/document-store";
import { ensureDemoLoaded } from "@/lib/server/demo-loader";
import { ingestPdf } from "@/lib/server/ingest";
import { isSafeId, MAX_UPLOAD_BYTES, MAX_UPLOADS_PER_WORKSPACE } from "@/lib/uploads";

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
  await ensureDemoLoaded(workspaceId);
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

  try {
    const document = await ingestPdf(workspaceId, filename, bytes, "user");
    return Response.json({ document }, { status: 201 });
  } catch (err) {
    console.error("[documents] save failed", err);
    return fail(500, `${filename}: the file could not be saved on the server.`);
  }
}
