"use client";

import { useEffect, useState } from "react";
import type { AnalysisResult } from "./analysis";
import type { MappingResult } from "./mapping";

interface Loaded {
  ws: string;
  aiConfigured: boolean;
  model: string;
  analysis: AnalysisResult | null;
  mapping: MappingResult | null;
}

/** Latest saved AI analysis + requirement mapping for a workspace (both live on the server). */
export function useResults(workspaceId: string) {
  const [data, setData] = useState<Loaded | null>(null);
  const [error, setError] = useState<{ ws: string; message: string } | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const q = `workspaceId=${encodeURIComponent(workspaceId)}`;
    Promise.all([fetch(`/api/analyze?${q}`), fetch(`/api/requirements/map?${q}`)])
      .then(async ([a, m]) => {
        const ja = await a.json();
        const jm = await m.json();
        if (!a.ok) throw new Error(ja.error ?? "Could not load AI results.");
        if (!m.ok) throw new Error(jm.error ?? "Could not load the evidence mapping.");
        if (cancelled) return;
        setData({ ws: workspaceId, aiConfigured: ja.aiConfigured, model: ja.model, analysis: ja.analysis, mapping: jm.mapping });
        setError(null);
      })
      .catch((e: Error) => !cancelled && setError({ ws: workspaceId, message: e.message }));
    return () => {
      cancelled = true;
    };
  }, [workspaceId, version]);

  const current = data?.ws === workspaceId ? data : null;
  return {
    loading: current === null && error?.ws !== workspaceId,
    error: error?.ws === workspaceId ? error.message : null,
    aiConfigured: current?.aiConfigured ?? false,
    model: current?.model ?? "",
    analysis: current?.analysis ?? null,
    mapping: current?.mapping ?? null,
    refresh: () => setVersion((v) => v + 1),
  };
}
