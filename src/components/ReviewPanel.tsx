"use client";

import { useState } from "react";
import { EVIDENCE_STATUS, type EvidenceStatus } from "@/lib/mapping";
import { DISPLAY_LABEL } from "@/lib/report";
import { changedSinceReview, EMPTY_REVIEW, FINDING_STATUS, FINDING_STATUS_LABEL, type Review } from "@/lib/review";
import { reviewActions, useReviews } from "@/lib/review-store";
import { useAppState } from "@/lib/store";
import { Badge, Button, Notice } from "./ui";

/** Labels for a reviewer setting the status. Choosing "missing" here is the confirmation. */
const REVIEWER_STATUS_LABEL: Record<EvidenceStatus, string> = {
  found: DISPLAY_LABEL.found,
  partial: DISPLAY_LABEL.partial,
  missing: "Missing — I confirm it is not in the dossier",
  conflicting: DISPLAY_LABEL.conflicting,
  needs_review: DISPLAY_LABEL.needs_review,
};

/** One-line review state for lists. */
export function reviewStateOf(r: Review | undefined, basis?: string) {
  const x = r ?? EMPTY_REVIEW;
  const changed = basis !== undefined && changedSinceReview(r, basis);
  if (x.dismissedReason) return { label: "Dismissed", tone: "neutral" as const, changed };
  if (x.decision === "accepted") return { label: "Accepted", tone: "teal" as const, changed };
  if (x.decision === "rejected") return { label: "Rejected", tone: "bad" as const, changed };
  if (x.reviewed) return { label: "Reviewed", tone: "teal" as const, changed };
  return { label: "Awaiting review", tone: "warn" as const, changed };
}

/**
 * Full reviewer controls, shown inside a detail drawer: mark reviewed, accept/reject an AI
 * suggestion, change status, add a note, dismiss a false positive with a reason.
 * Saved per workspace in this browser, keyed so it survives re-running the AI.
 */
export function ReviewPanel({
  itemKey,
  basis,
  kind,
  aiSuggestion,
}: {
  itemKey: string;
  basis: string;
  kind: "requirement" | "finding" | "fact";
  aiSuggestion: boolean;
  compact?: boolean;
}) {
  const { workspaceId } = useAppState();
  const reviews = useReviews(workspaceId);
  const stored = reviews[itemKey];
  const r: Review = stored ?? EMPTY_REVIEW;
  const [dismissing, setDismissing] = useState(false);
  const [reason, setReason] = useState("");
  const save = (patch: Partial<Review>) => reviewActions.update(workspaceId, itemKey, basis, patch);
  const changed = changedSinceReview(stored, basis);
  const state = reviewStateOf(stored, basis);

  if (r.dismissedReason) {
    return (
      <div className="space-y-2 text-sm">
        <div className="flex items-center gap-2">
          <Badge>Dismissed as false positive</Badge>
        </div>
        <p className="text-ink-soft">Reason: {r.dismissedReason}</p>
        <Button size="sm" onClick={() => save({ dismissedReason: null })}>
          Undo dismiss
        </Button>
      </div>
    );
  }

  const statusOptions =
    kind === "requirement"
      ? EVIDENCE_STATUS.map((s) => ({ value: s, label: REVIEWER_STATUS_LABEL[s] }))
      : kind === "finding"
        ? FINDING_STATUS.filter((s) => s !== "open").map((s) => ({ value: s, label: FINDING_STATUS_LABEL[s] }))
        : [];

  return (
    <div className="space-y-4 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={state.tone}>{state.label}</Badge>
        {changed && <Badge tone="warn">Evidence changed since your review</Badge>}
        {r.updatedAt && <span className="text-xs text-mute">Updated {new Date(r.updatedAt).toLocaleString()}</span>}
      </div>

      {aiSuggestion && (
        <div>
          <div className="mb-1.5 text-xs text-ink-soft">
            {kind === "requirement"
              ? "Do you agree with the suggested evidence status? Accepting a “not found” result confirms the evidence is missing."
              : "Do you agree with this suggestion?"}
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={r.decision === "accepted" ? "primary" : "secondary"}
              aria-pressed={r.decision === "accepted"}
              onClick={() => save({ decision: r.decision === "accepted" ? "undecided" : "accepted", reviewed: true })}
            >
              Accept
            </Button>
            <Button
              size="sm"
              variant={r.decision === "rejected" ? "danger" : "secondary"}
              aria-pressed={r.decision === "rejected"}
              onClick={() => save({ decision: r.decision === "rejected" ? "undecided" : "rejected", reviewed: true })}
            >
              Reject
            </Button>
          </div>
        </div>
      )}

      {statusOptions.length > 0 && (
        <label className="block">
          <span className="mb-1 block text-xs text-ink-soft">Set status</span>
          <select
            className="w-full rounded-md border border-line bg-white px-2 py-1.5 text-sm text-ink focus:border-teal focus:outline-none focus-visible:ring-2 focus-visible:ring-teal"
            value={r.status ?? ""}
            onChange={(e) => save({ status: (e.target.value || null) as Review["status"] })}
          >
            <option value="">{kind === "requirement" ? "Keep the suggested status" : "Open"}</option>
            {statusOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      )}

      <label className="block">
        <span className="mb-1 block text-xs text-ink-soft">Reviewer note</span>
        <textarea
          key={`${itemKey}-${r.updatedAt}`}
          aria-label="Reviewer note"
          className="w-full rounded-md border border-line px-2 py-1.5 text-sm text-ink focus:border-teal focus:outline-none focus-visible:ring-2 focus-visible:ring-teal"
          rows={2}
          defaultValue={r.note}
          placeholder="Optional — saved when you leave the field"
          onBlur={(e) => {
            if (e.target.value !== r.note) save({ note: e.target.value.slice(0, 2000) });
          }}
        />
      </label>

      <div className="flex flex-wrap items-center gap-2">
        <Button variant={r.reviewed ? "secondary" : "primary"} aria-pressed={r.reviewed} onClick={() => save({ reviewed: !r.reviewed })}>
          {r.reviewed ? "✓ Reviewed — undo" : "Mark as reviewed"}
        </Button>
        {!dismissing && (
          <Button variant="ghost" size="sm" onClick={() => setDismissing(true)}>
            Dismiss as false positive…
          </Button>
        )}
      </div>

      {dismissing && (
        <Notice tone="neutral">
          <label className="block">
            <span className="mb-1 block text-xs text-ink-soft">Why is this a false positive? (required)</span>
            <input
              aria-label="Reason for dismissing"
              className="w-full rounded-md border border-line px-2 py-1.5 text-sm text-ink focus:border-teal focus:outline-none"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              autoFocus
            />
          </label>
          <div className="mt-2 flex gap-2">
            <Button
              size="sm"
              variant="danger"
              disabled={reason.trim().length < 3}
              onClick={() => {
                save({ dismissedReason: reason.trim().slice(0, 500), reviewed: true });
                setDismissing(false);
                setReason("");
              }}
            >
              Dismiss
            </Button>
            <Button size="sm" onClick={() => setDismissing(false)}>
              Cancel
            </Button>
          </div>
        </Notice>
      )}
    </div>
  );
}
