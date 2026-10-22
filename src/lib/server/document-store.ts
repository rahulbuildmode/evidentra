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

/**
 * Per-instance cache of document records. A record never changes after upload (a new upload gets a
 * new id; demo files are rewritten with identical content), so it is safe to keep. Bounded in size.
 */
const MAX_CACHED = 300;
const cache = new Map<string, UploadedDocument>();
function remember(key: string, doc: UploadedDocument) {
  cache.delete(key);
  cache.set(key, doc);
  if (cache.size > MAX_CACHED) cache.delete(cache.keys().next().value!);
}

export function toMeta(doc: UploadedDocument): UploadedDocumentMeta {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { pages, ...meta } = doc;
  return meta;
}

export async function saveDocument(doc: UploadedDocument, pdfBytes: Uint8Array): Promise<void> {
  const key = recordKey(doc.workspaceId, doc.id);
  await Promise.all([storage().write(`${workspacePrefix(doc.workspaceId)}${doc.id}.pdf`, pdfBytes, "application/pdf"), writeJson(key, doc)]);
  remember(key, doc);
}

export async function getDocument(workspaceId: string, id: string): Promise<UploadedDocument | null> {
  const key = recordKey(workspaceId, id);
  const hit = cache.get(key);
  if (hit) return hit;
  const doc = await readJson<UploadedDocument>(key);
  if (!doc || doc.workspaceId !== workspaceId) return null;
  remember(key, doc);
  return doc;
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
  cache.delete(recordKey(workspaceId, id));
  await storage().remove([recordKey(workspaceId, id), `${workspacePrefix(workspaceId)}${id}.pdf`]);
  return existed;
}

/** Cheap existence check: one storage listing, no document reads. */
export async function hasDocuments(workspaceId: string): Promise<boolean> {
  return (await storage().list(workspacePrefix(workspaceId))).some((k) => k.endsWith(".json"));
}

/** Remove every upload of a workspace (used when reloading the demo). */
export async function clearDocuments(workspaceId: string): Promise<void> {
  const prefix = workspacePrefix(workspaceId);
  for (const k of [...cache.keys()]) if (k.startsWith(prefix)) cache.delete(k);
  await storage().remove(await storage().list(prefix));
}
