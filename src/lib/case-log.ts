"use client";

import { useSyncExternalStore } from "react";

/**
 * A small per-workspace log of genuine user actions that the server does not record: opening a
 * source page whose quotation code verified, and exporting the case summary. Saved in this browser.
 */
export interface CaseLog {
  inspectedVerifiedQuote?: { at: string; filename: string; page: number | null };
  exported?: { at: string; kind: "csv" | "print" };
}

const KEY = "evidentra:case-log:v1";
const EMPTY: Record<string, CaseLog> = {};
const NO_LOG: CaseLog = {};
const listeners = new Set<() => void>();
let cache: { raw: string | null; all: Record<string, CaseLog> } | null = null;

function read(): Record<string, CaseLog> {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(KEY);
  } catch {
    return cache?.all ?? EMPTY;
  }
  if (cache && cache.raw === raw) return cache.all;
  let all = EMPTY;
  try {
    if (raw) all = JSON.parse(raw) as Record<string, CaseLog>;
  } catch {
    /* corrupt: start empty */
  }
  cache = { raw, all };
  return all;
}

function write(all: Record<string, CaseLog>) {
  const raw = JSON.stringify(all);
  cache = { raw, all };
  try {
    window.localStorage.setItem(KEY, raw);
  } catch {
    /* storage blocked: keep in memory */
  }
  listeners.forEach((l) => l());
}

export function useCaseLog(workspaceId: string): CaseLog {
  const all = useSyncExternalStore(
    (cb) => (listeners.add(cb), () => listeners.delete(cb)),
    read,
    () => EMPTY,
  );
  return all[workspaceId] ?? NO_LOG;
}

export const caseLog = {
  record(workspaceId: string, patch: CaseLog) {
    const all = read();
    const cur = all[workspaceId] ?? {};
    // Keep the first time each action happened.
    const next: CaseLog = { ...patch, ...cur };
    if (JSON.stringify(next) === JSON.stringify(cur)) return;
    write({ ...all, [workspaceId]: next });
  },
};
