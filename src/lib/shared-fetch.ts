"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Tiny shared cache for client fetches, so every chapter of the page reads the
 * same data with one request. Entries are immutable snapshots; refresh() re-fetches for everyone.
 */
interface Entry<T> {
  data?: T;
  error?: string;
  loading: boolean;
  inflight?: boolean;
}

const cache = new Map<string, Entry<unknown>>();
const listeners = new Map<string, Set<() => void>>();
const fetchers = new Map<string, () => Promise<unknown>>();
const SERVER: Entry<never> = { loading: true };

function set(key: string, e: Entry<unknown>) {
  cache.set(key, e);
  listeners.get(key)?.forEach((l) => l());
}

const inflight = new Map<string, Promise<void>>();

function load(key: string): Promise<void> {
  const fetcher = fetchers.get(key);
  const cur = cache.get(key);
  if (!fetcher) return Promise.resolve();
  if (cur?.inflight) return inflight.get(key) ?? Promise.resolve();
  set(key, { ...cur, loading: cur?.data === undefined, inflight: true });
  const p = fetcher()
    .then((data) => set(key, { data, loading: false }))
    .catch((e: Error) => set(key, { data: cur?.data, error: e.message || "Request failed.", loading: false }))
    .finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

/** Re-fetch every cached entry whose key starts with `prefix`; resolves when all have loaded. */
export function refreshShared(prefix: string): Promise<void> {
  return Promise.all([...cache.keys()].filter((k) => k.startsWith(prefix)).map(load)).then(() => undefined);
}

export function useShared<T>(key: string, fetcher: () => Promise<T>) {
  fetchers.set(key, fetcher);
  const subscribe = useCallback(
    (cb: () => void) => {
      if (!listeners.has(key)) listeners.set(key, new Set());
      listeners.get(key)!.add(cb);
      if (!cache.has(key)) queueMicrotask(() => load(key));
      return () => listeners.get(key)?.delete(cb);
    },
    [key],
  );
  const entry = useSyncExternalStore(
    subscribe,
    () => (cache.get(key) as Entry<T> | undefined) ?? SERVER,
    () => SERVER,
  );
  const refresh = useCallback(() => load(key), [key]);
  return { ...entry, refresh };
}
