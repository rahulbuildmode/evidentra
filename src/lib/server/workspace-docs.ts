import type { UploadedDocument } from "../uploads";
import { getDocument, listDocuments } from "./document-store";

/** Load a workspace's documents that have usable text, and list the ones skipped. */
export async function loadReadableDocuments(workspaceId: string) {
  const metas = await listDocuments(workspaceId);
  const docs: UploadedDocument[] = [];
  const skipped: { filename: string; reason: string }[] = [];
  for (const m of metas) {
    if (m.status !== "extracted") {
      skipped.push({
        filename: m.filename,
        reason: m.status === "needs_ocr" ? "no extractable text (needs OCR)" : "extraction failed",
      });
      continue;
    }
    const d = await getDocument(workspaceId, m.id);
    if (d) docs.push(d);
  }
  return { docs, skipped };
}
