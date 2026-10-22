"use client";

import { useSyncExternalStore } from "react";
import { BLANK_STATE, DEMO_STATE } from "./demo-data";
import { todayISO } from "./checks";
import type { AppState, Decision, DocumentRecord, WorkspaceFieldKey } from "./types";

const KEY = "evidentra:v1";
const listeners = new Set<() => void>();
let cache: { raw: string | null; state: AppState } | null = null;

function read(): AppState {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(KEY);
  } catch {
    return cache?.state ?? DEMO_STATE;
  }
  if (cache && cache.raw === raw) return cache.state;
  let state = DEMO_STATE;
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as AppState;
      if (parsed && parsed.workspace && Array.isArray(parsed.documents)) state = parsed;
    } catch {
      /* corrupt saved data: fall back to the demo */
    }
  }
  cache = { raw, state };
  return state;
}

function write(next: AppState) {
  const raw = JSON.stringify(next);
  cache = { raw, state: next };
  try {
    window.localStorage.setItem(KEY, raw);
  } catch {
    /* storage full or blocked: keep in memory for this session */
  }
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function useAppState(): AppState {
  return useSyncExternalStore(subscribe, read, () => DEMO_STATE);
}

export const actions = {
  setField(key: WorkspaceFieldKey, value: string) {
    const s = read();
    // Editing a value un-verifies it: the user must re-confirm the new text.
    write({ ...s, workspace: { ...s.workspace, [key]: { value, verified: false } } });
  },
  setVerified(key: WorkspaceFieldKey, verified: boolean) {
    const s = read();
    write({
      ...s,
      workspace: { ...s.workspace, [key]: { ...s.workspace[key], verified } },
    });
  },
  resetDemo() {
    write(DEMO_STATE);
  },
  startBlank() {
    write(BLANK_STATE);
  },
  addUpload(d: DocumentRecord) {
    const s = read();
    write({ ...s, documents: [...s.documents, d] });
  },
  removeDocument(id: string) {
    const s = read();
    const gone = s.documents.find((d) => d.id === id);
    write({
      ...s,
      documents: s.documents.filter((d) => d.id !== id),
      facts: s.facts.filter((f) => f.documentId !== id),
      // Evidence pointing at a removed file is no longer traceable, so drop it too.
      evidence: s.evidence.filter((e) => !gone || e.filename !== gone.filename),
    });
  },
  setDecision(requirementId: string, decision: Decision) {
    const s = read();
    write({ ...s, decisions: { ...s.decisions, [requirementId]: decision } });
  },
};

/** Today's date from the browser clock. Null on the server/first render so nothing is prerendered with a stale date. */
export function useToday(): string | null {
  return useSyncExternalStore(
    () => () => {},
    () => todayISO(),
    () => null,
  );
}
