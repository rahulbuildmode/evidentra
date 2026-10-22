"use client";

import { useCaseLog } from "./case-log";
import { achievements, missionTasks, type CaseInputs } from "./case-progress";
import { useReviews } from "./review-store";
import { useGapReport } from "./use-report";
import { useValidation } from "./use-validation";

const NEEDS_DECISION = new Set(["conflict_detected", "potential_gap", "needs_human_review"]);

/** Mission tasks and achievements for the current case, from live application state. */
export function useCaseProgress() {
  const { state, report, uploads, loading } = useGapReport();
  const { report: v, error } = useValidation(state.workspaceId);
  const reviews = useReviews(state.workspaceId);
  const log = useCaseLog(state.workspaceId);
  const inputs: CaseInputs = {
    readableDocs: uploads.uploads.filter((u) => u.status === "extracted").length,
    pathwayInScope: v?.decision.status === "in_scope",
    analysis: report.analysis ? { source: report.analysis.source === "demo-seed" ? "demo-seed" : "gemini", runId: report.analysis.runId } : null,
    leads: report.findings.filter((f) => !f.dismissed).map((f) => ({ key: f.key, reviewed: f.humanReviewed })),
    checks: (v?.results ?? []).filter((r) => NEEDS_DECISION.has(r.status)).map((r) => ({ id: r.requirementId, reviewed: Boolean(reviews[`req:${r.requirementId}`]?.reviewed) })),
    log,
  };
  const tasks = missionTasks(inputs);
  return {
    tasks,
    achievements: achievements(inputs),
    done: tasks.filter((t) => t.done).length,
    total: tasks.length,
    workspaceId: state.workspaceId,
    /** True once the case's server data has loaded (so a page load is not mistaken for new progress). */
    ready: !loading && (v !== null || error !== null),
  };
}
