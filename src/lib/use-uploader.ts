"use client";

import { useState } from "react";
import { refreshShared } from "./shared-fetch";
import { actions } from "./store";
import { MAX_UPLOAD_BYTES, MAX_UPLOADS_PER_WORKSPACE } from "./uploads";

function precheck(file: File): string | null {
  if (!file.name.toLowerCase().endsWith(".pdf")) return "only PDF files are supported.";
  if (file.size === 0) return "the file is empty.";
  if (file.size > MAX_UPLOAD_BYTES) return "the file is larger than 4 MB.";
  return null;
}

/** Upload PDFs through POST /api/documents (server validates and extracts); remove with DELETE. */
export function useUploader(workspaceId: string, existing: number) {
  const [pending, setPending] = useState<string[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [justAdded, setJustAdded] = useState<string[]>([]);
  const slotsLeft = MAX_UPLOADS_PER_WORKSPACE - existing - pending.length;

  async function upload(list: FileList | File[] | null) {
    if (!list || list.length === 0) return;
    const problems: string[] = [];
    let room = slotsLeft;
    for (const file of Array.from(list)) {
      const problem = room <= 0 ? `limit of ${MAX_UPLOADS_PER_WORKSPACE} documents reached.` : precheck(file);
      if (problem) {
        problems.push(`${file.name}: ${problem}`);
        continue;
      }
      room--;
      setPending((p) => [...p, file.name]);
      try {
        const body = new FormData();
        body.append("workspaceId", workspaceId);
        body.append("file", file);
        const res = await fetch("/api/documents", { method: "POST", body });
        const j = await res.json().catch(() => ({}));
        if (!res.ok) problems.push(j.error ?? `${file.name}: upload failed (HTTP ${res.status}).`);
        else if (j.document?.id) setJustAdded((x) => [...x, j.document.id]);
      } catch {
        problems.push(`${file.name}: could not reach the server. Try again.`);
      } finally {
        setPending((p) => p.filter((n) => n !== file.name));
        await refreshShared(`uploads:${workspaceId}`);
        void refreshShared(`results:${workspaceId}`);
      }
    }
    setErrors(problems);
  }

  async function remove(id: string, filename: string) {
    if (!window.confirm(`Remove ${filename} from this dossier?`)) return;
    const res = await fetch(`/api/documents/${id}?workspaceId=${encodeURIComponent(workspaceId)}`, { method: "DELETE" }).catch(() => null);
    if (!res || !res.ok) setErrors(["The document could not be removed. Try again."]);
    await refreshShared(`uploads:${workspaceId}`);
    void refreshShared(`results:${workspaceId}`);
  }

  return { upload, remove, pending, errors, clearErrors: () => setErrors([]), justAdded, slotsLeft };
}

/** Switch to the fictional demo dossier and (re)load it on the server. */
export async function loadSyntheticDemo(): Promise<void> {
  actions.resetDemo();
  const res = await fetch("/api/demo/load", { method: "POST" });
  if (!res.ok) throw new Error("The synthetic demo could not be loaded.");
  await refreshShared("");
}

/** Start an empty dossier of the user's own (new workspace id). */
export async function startOwnDossier(): Promise<void> {
  actions.startBlank();
  await refreshShared("");
}
