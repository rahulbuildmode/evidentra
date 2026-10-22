"use client";

import { useShared } from "./shared-fetch";
import type { UploadedDocumentMeta } from "./uploads";

async function fetchUploads(workspaceId: string): Promise<UploadedDocumentMeta[]> {
  const r = await fetch(`/api/documents?workspaceId=${encodeURIComponent(workspaceId)}`);
  const j = await r.json();
  if (!r.ok) throw new Error(j.error ?? "Could not load documents.");
  return j.documents;
}

/** Server-side upload list for one workspace. Call `refresh()` after uploading or deleting. */
export function useUploads(workspaceId: string) {
  const e = useShared(`uploads:${workspaceId}`, () => fetchUploads(workspaceId));
  return {
    uploads: e.data ?? [],
    loading: e.loading && e.data === undefined,
    error: e.error ?? null,
    refresh: e.refresh,
  };
}
