/** Shared (client + server) shapes and limits for uploaded documents. No Node imports here. */

export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024; // stays under Vercel's ~4.5 MB request body limit
export const MAX_UPLOADS_PER_WORKSPACE = 10;

export type UploadStatus = "extracted" | "needs_ocr" | "failed";

export interface PageText {
  page: number; // 1-based PDF page index (not the printed page label)
  text: string;
}

export interface UploadedDocumentMeta {
  id: string;
  workspaceId: string;
  filename: string;
  sizeBytes: number;
  uploadedAt: string;
  status: UploadStatus;
  pageCount: number | null;
  charCount: number;
  /** Pages with no extractable text (likely scanned images). */
  emptyPages: number[];
  error: string | null;
  /** "demo" = loaded from the fictional demo dossier; absent/"user" = uploaded by the user. */
  origin?: "demo" | "user";
}

export interface UploadedDocument extends UploadedDocumentMeta {
  pages: PageText[];
}

export const STATUS_LABEL: Record<UploadStatus, string> = {
  extracted: "Text extracted",
  needs_ocr: "No extractable text — needs OCR",
  failed: "Extraction failed",
};

const ID_RE = /^[a-z0-9-]{1,64}$/;
/** IDs become file names on the server, so only allow a safe character set. */
export function isSafeId(id: string | null | undefined): id is string {
  return typeof id === "string" && ID_RE.test(id);
}
