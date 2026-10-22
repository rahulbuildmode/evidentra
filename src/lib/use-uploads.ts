"use client";

import { useEffect, useState } from "react";
import type { UploadedDocumentMeta } from "./uploads";

/** Loads the server-side upload list for one workspace. Call `refresh()` after uploading or deleting. */
export function useUploads(workspaceId: string) {
  const [data, setData] = useState<{ ws: string; docs: UploadedDocumentMeta[] } | null>(null);
  const [error, setError] = useState<{ ws: string; message: string } | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/documents?workspaceId=${encodeURIComponent(workspaceId)}`)
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error ?? "Could not load documents.");
        return j.documents as UploadedDocumentMeta[];
      })
      .then((docs) => {
        if (cancelled) return;
        setData({ ws: workspaceId, docs });
        setError(null);
      })
      .catch((e: Error) => {
        if (!cancelled) setError({ ws: workspaceId, message: e.message || "Could not load documents." });
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceId, version]);

  const current = data?.ws === workspaceId ? data.docs : null;
  const currentError = error?.ws === workspaceId ? error.message : null;
  return {
    uploads: current ?? [],
    loading: current === null && currentError === null,
    error: currentError,
    refresh: () => setVersion((v) => v + 1),
  };
}
