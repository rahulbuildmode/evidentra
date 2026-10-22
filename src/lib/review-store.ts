"use client";

import { useSyncExternalStore } from "react";
import { EMPTY_REVIEW, type Review } from "./review";

/**
 * Human reviews, saved in this browser per workspace id (separate from the workspace form,
 * so re-running AI, regenerating the report or reloading the demo never erases them).
 */
type AllReviews = Record<string, Record<string, Review>>;

const KEY = "evidentra:reviews:v1";
const EMPTY: AllReviews = {};
const listeners = new Set<() => void>();
let cache: { raw: string | null; all: AllReviews } | null = null;

function read(): AllReviews {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(KEY);
  } catch {
    return cache?.all ?? EMPTY;
  }
  if (cache && cache.raw === raw) return cache.all;
  let all: AllReviews = EMPTY;
  try {
    if (raw) all = JSON.parse(raw) as AllReviews;
  } catch {
    /* corrupt: start empty rather than crash */
  }
  cache = { raw, all };
  return all;
}

function write(all: AllReviews) {
  const raw = JSON.stringify(all);
  cache = { raw, all };
  try {
    window.localStorage.setItem(KEY, raw);
  } catch {
    /* storage blocked: keep in memory for this session */
  }
  listeners.forEach((l) => l());
}

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};

const NO_REVIEWS: Record<string, Review> = {};

export function useReviews(workspaceId: string): Record<string, Review> {
  const all = useSyncExternalStore(subscribe, read, () => EMPTY);
  return all[workspaceId] ?? NO_REVIEWS;
}

export const reviewActions = {
  update(workspaceId: string, key: string, basis: string, patch: Partial<Omit<Review, "basis" | "updatedAt">>) {
    const all = read();
    const ws = all[workspaceId] ?? {};
    const next: Review = { ...EMPTY_REVIEW, ...ws[key], ...patch, basis, updatedAt: new Date().toISOString() };
    write({ ...all, [workspaceId]: { ...ws, [key]: next } });
  },
  clear(workspaceId: string, key: string) {
    const all = read();
    const ws = { ...(all[workspaceId] ?? {}) };
    delete ws[key];
    write({ ...all, [workspaceId]: ws });
  },
  clearWorkspace(workspaceId: string) {
    const all = { ...read() };
    delete all[workspaceId];
    write(all);
  },
};
