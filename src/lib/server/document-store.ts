import type { UploadedDocument, UploadedDocumentMeta } from "../uploads";
import { isSafeId } from "../uploads";
import { readJson, storage, writeJson } from "./storage";

export { dataRoot } from "./storage";

/**
 * One folder per workspace in private storage (see storage.ts): local `.data/` on a developer
 * machine, a private Vercel Blob store when deployed. Files are never served directly.
 */
function workspacePrefix(workspaceId: string): string {
  if (!isSafeId(workspaceId)) throw new Error("Invalid workspace id");
  return `uploads/${workspaceId}/`;
}

function recordKey(workspaceId: string, id: string): string {
  if (!isSafeId(id)) throw new Error("Invalid document id");
  return `${workspacePrefix(workspaceId)}${id}.json`;
}

export function toMeta(doc: UploadedDocument): UploadedDocumentMeta {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { pages, ...meta } = doc;
  return meta;
}

export async function saveDocument(doc: UploadedDocument, pdfBytes: Uint8Array): Promise<void> {
  await storage().write(`${workspacePrefix(doc.workspaceId)}${doc.id}.pdf`, pdfBytes, "application/pdf");
  await writeJson(recordKey(doc.workspaceId, doc.id), doc);
}

export async function getDocument(workspaceId: string, id: string): Promise<UploadedDocument | null> {
  const doc = await readJson<UploadedDocument>(recordKey(workspaceId, id));
  return doc && doc.workspaceId === workspaceId ? doc : null;
}

export async function listDocuments(workspaceId: string): Promise<UploadedDocumentMeta[]> {
  const prefix = workspacePrefix(workspaceId);
  const ids = (await storage().list(prefix)).filter((k) => k.endsWith(".json")).map((k) => k.slice(prefix.length, -5));
  const docs = await Promise.all(ids.filter((id) => isSafeId(id)).map((id) => getDocument(workspaceId, id)));
  return docs
    .filter((d): d is UploadedDocument => d !== null)
    .map(toMeta)
    .sort((a, b) => a.uploadedAt.localeCompare(b.uploadedAt));
}

export async function deleteDocument(workspaceId: string, id: string): Promise<boolean> {
  const existed = (await getDocument(workspaceId, id)) !== null;
  await storage().remove([recordKey(workspaceId, id), `${workspacePrefix(workspaceId)}${id}.pdf`]);
  return existed;
}

/** Remove every upload of a workspace (used when reloading the demo). */
export async function clearDocuments(workspaceId: string): Promise<void> {
  await storage().remove(await storage().list(workspacePrefix(workspaceId)));
}
