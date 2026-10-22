import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { UploadedDocument, UploadedDocumentMeta } from "../uploads";
import { isSafeId } from "../uploads";

/**
 * Prototype storage: one folder per workspace on the server's disk, outside `public/`,
 * so files are never served directly. Locally this is `.data/` (git-ignored).
 * On Vercel only /tmp is writable and it is wiped between instances — see README.
 */
export function dataRoot(): string {
  if (process.env.EVIDENTRA_DATA_DIR) return process.env.EVIDENTRA_DATA_DIR;
  if (process.env.VERCEL) return "/tmp/evidentra-data";
  return path.join(process.cwd(), ".data");
}

function workspaceDir(workspaceId: string): string {
  if (!isSafeId(workspaceId)) throw new Error("Invalid workspace id");
  return path.join(dataRoot(), "uploads", workspaceId);
}

function recordPath(workspaceId: string, id: string): string {
  if (!isSafeId(id)) throw new Error("Invalid document id");
  return path.join(workspaceDir(workspaceId), `${id}.json`);
}

export function toMeta(doc: UploadedDocument): UploadedDocumentMeta {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { pages, ...meta } = doc;
  return meta;
}

export async function saveDocument(doc: UploadedDocument, pdfBytes: Uint8Array): Promise<void> {
  const dir = workspaceDir(doc.workspaceId);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, `${doc.id}.pdf`), pdfBytes);
  await writeFile(recordPath(doc.workspaceId, doc.id), JSON.stringify(doc));
}

export async function getDocument(workspaceId: string, id: string): Promise<UploadedDocument | null> {
  try {
    return JSON.parse(await readFile(recordPath(workspaceId, id), "utf8")) as UploadedDocument;
  } catch {
    return null;
  }
}

export async function listDocuments(workspaceId: string): Promise<UploadedDocumentMeta[]> {
  let names: string[];
  try {
    names = await readdir(workspaceDir(workspaceId));
  } catch {
    return []; // folder not created yet = no uploads
  }
  const out: UploadedDocumentMeta[] = [];
  for (const name of names.filter((n) => n.endsWith(".json"))) {
    const doc = await getDocument(workspaceId, name.slice(0, -5));
    if (doc) out.push(toMeta(doc));
  }
  return out.sort((a, b) => a.uploadedAt.localeCompare(b.uploadedAt));
}

export async function deleteDocument(workspaceId: string, id: string): Promise<boolean> {
  const rec = recordPath(workspaceId, id);
  const existed = (await getDocument(workspaceId, id)) !== null;
  await rm(rec, { force: true });
  await rm(path.join(workspaceDir(workspaceId), `${id}.pdf`), { force: true });
  return existed;
}

