"use client";

import { buildReport } from "./report";
import { getRequirementSet, SYNTHETIC_DEMO_SET } from "./requirements";
import { useReviews } from "./review-store";
import { useAppState, useToday } from "./store";
import { useResults } from "./use-results";
import { useUploads } from "./use-uploads";

/** The live gap report for the current workspace, recomputed whenever any input changes. */
export function useGapReport() {
  const state = useAppState();
  const today = useToday();
  const results = useResults(state.workspaceId);
  const uploads = useUploads(state.workspaceId);
  const reviews = useReviews(state.workspaceId);
  const set = getRequirementSet(state.requirementSetId) ?? SYNTHETIC_DEMO_SET;
  const report = buildReport({
    state,
    set,
    mapping: results.mapping,
    analysis: results.analysis,
    uploads: uploads.uploads,
    reviews,
    today,
  });
  return {
    state,
    report,
    results,
    uploads,
    loading: results.loading || uploads.loading,
    refresh: () => {
      results.refresh();
      uploads.refresh();
    },
  };
}
