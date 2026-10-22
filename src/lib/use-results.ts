"use client";

import type { AnalysisResult } from "./analysis";
import type { MappingResult } from "./mapping";
import { useShared } from "./shared-fetch";

interface Loaded {
  aiConfigured: boolean;
  model: string;
  analysis: AnalysisResult | null;
  mapping: MappingResult | null;
}

async function fetchResults(workspaceId: string): Promise<Loaded> {
  const q = `workspaceId=${encodeURIComponent(workspaceId)}`;
  const [a, m] = await Promise.all([fetch(`/api/analyze?${q}`), fetch(`/api/requirements/map?${q}`)]);
  const ja = await a.json();
  const jm = await m.json();
  if (!a.ok) throw new Error(ja.error ?? "Could not load AI results.");
  if (!m.ok) throw new Error(jm.error ?? "Could not load the evidence matches.");
  return { aiConfigured: ja.aiConfigured, model: ja.model, analysis: ja.analysis, mapping: jm.mapping };
}

/** Latest saved AI analysis + evidence mapping for a workspace (both live on the server). */
export function useResults(workspaceId: string) {
  const e = useShared(`results:${workspaceId}`, () => fetchResults(workspaceId));
  return {
    loading: e.loading && e.data === undefined,
    error: e.error ?? null,
    aiConfigured: e.data?.aiConfigured ?? false,
    model: e.data?.model ?? "",
    analysis: e.data?.analysis ?? null,
    mapping: e.data?.mapping ?? null,
    refresh: e.refresh,
  };
}
