"use client";

import type { DeviceProfile, ValidationReport } from "./regulatory/types";
import { useShared } from "./shared-fetch";

async function getJson<T>(url: string, key: string): Promise<T> {
  const res = await fetch(url);
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.error ?? `Request failed (HTTP ${res.status}).`);
  return j[key] as T;
}

/** The CDSCO validation report prepared by the server (keys share the "results:" prefix so runs refresh them). */
export function useValidation(workspaceId: string) {
  const e = useShared(`results:${workspaceId}:validation`, () =>
    getJson<ValidationReport>(`/api/validation?workspaceId=${encodeURIComponent(workspaceId)}`, "report"),
  );
  return { report: e.data ?? null, loading: e.loading && e.data === undefined, error: e.error ?? null, refresh: e.refresh };
}

export function useProfile(workspaceId: string) {
  const e = useShared(`results:${workspaceId}:profile`, () =>
    getJson<DeviceProfile>(`/api/profile?workspaceId=${encodeURIComponent(workspaceId)}`, "profile"),
  );
  return { profile: e.data ?? null, loading: e.loading && e.data === undefined, error: e.error ?? null };
}
