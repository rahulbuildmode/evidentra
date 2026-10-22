"use client";

import { useState } from "react";
import { EVIDENCE_LABEL, EVIDENCE_STATUS } from "@/lib/mapping";
import { changedSinceReview, EMPTY_REVIEW, FINDING_STATUS, FINDING_STATUS_LABEL, type Review } from "@/lib/review";
import { reviewActions, useReviews } from "@/lib/review-store";
import { useAppState } from "@/lib/store";
import { Badge, Button } from "./ui";

/**
 * Human review controls for one item: mark reviewed, accept/reject an AI suggestion,
 * change status, add a note, or dismiss a false positive with a reason.
 * Stored per workspace in this browser; keyed so it survives re-runs of the AI.
 */
export function ReviewPanel({
  itemKey,
  basis,
  kind,
  aiSuggestion,
  compact = false,
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
  const [showNote, setShowNote] = useState(false);
  const save = (patch: Partial<Review>) => reviewActions.update(workspaceId, itemKey, basis, patch);
  const changed = changedSinceReview(stored, basis);

  if (r.dismissedReason) {
    return (
      <div className="space-y-1 text-xs">
        <Badge>Dismissed</Badge>
        <div className="text-ink-soft">Reason: {r.dismissedReason}</div>
        <button type="button" className="no-print text-teal underline" onClick={() => save({ dismissedReason: null })}>
          Undo dismiss
        </button>
      </div>
    );
  }

  const statusOptions =
    kind === "requirement"
      ? EVIDENCE_STATUS.map((s) => ({ value: s, label: EVIDENCE_LABEL[s] }))
      : kind === "finding"
        ? FINDING_STATUS.map((s) => ({ value: s, label: FINDING_STATUS_LABEL[s] }))
        : [];

  return (
    <div className={`space-y-2 text-xs ${compact ? "" : "min-w-[13rem]"}`}>
      <div className="flex flex-wrap items-center gap-1">
        {r.reviewed ? <Badge tone="teal">Reviewed</Badge> : <Badge>Awaiting review</Badge>}
        {r.decision === "accepted" && <Badge tone="teal">AI suggestion accepted</Badge>}
        {r.decision === "rejected" && <Badge tone="bad">AI suggestion rejected</Badge>}
        {changed && <Badge tone="warn">Changed since review</Badge>}
      </div>

      <div className="no-print flex flex-wrap gap-1">
        <Button className="px-2! py-1! text-xs!" variant={r.reviewed ? "primary" : "secondary"} aria-pressed={r.reviewed} onClick={() => save({ reviewed: !r.reviewed })}>
          {r.reviewed ? "✓ Reviewed" : "Mark reviewed"}
        </Button>
        {aiSuggestion && (
          <>
            <Button
              className="px-2! py-1! text-xs!"
              variant={r.decision === "accepted" ? "primary" : "secondary"}
              aria-pressed={r.decision === "accepted"}
              onClick={() => save({ decision: r.decision === "accepted" ? "undecided" : "accepted", reviewed: true })}
            >
              Accept
            </Button>
            <Button
              className="px-2! py-1! text-xs!"
              variant={r.decision === "rejected" ? "danger" : "secondary"}
              aria-pressed={r.decision === "rejected"}
              onClick={() => save({ decision: r.decision === "rejected" ? "undecided" : "rejected", reviewed: true })}
            >
              Reject
            </Button>
          </>
        )}
      </div>

      {statusOptions.length > 0 && (
        <label className="no-print flex items-center gap-1 text-mute">
          Status
          <select
            className="rounded border border-line bg-white px-1 py-0.5 text-xs text-ink"
            value={r.status ?? ""}
            onChange={(e) => save({ status: (e.target.value || null) as Review["status"] })}
          >
            <option value="">{kind === "requirement" ? "As proposed" : "Open"}</option>
            {statusOptions
              .filter((o) => kind === "requirement" || o.value !== "open")
              .map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
          </select>
        </label>
      )}

      {r.note && !showNote && <div className="rounded bg-background px-2 py-1 text-ink-soft">Note: {r.note}</div>}
      {showNote ? (
        <div className="no-print">
          <textarea
            aria-label="Reviewer note"
            className="w-full rounded border border-line px-2 py-1 text-xs text-ink"
            rows={2}
            defaultValue={r.note}
            autoFocus
            onBlur={(e) => {
              if (e.target.value !== r.note) save({ note: e.target.value.slice(0, 2000) });
              setShowNote(false);
            }}
          />
        </div>
      ) : (
        <button type="button" className="no-print text-teal underline" onClick={() => setShowNote(true)}>
          {r.note ? "Edit note" : "Add note"}
        </button>
      )}

      {dismissing ? (
        <div className="no-print space-y-1">
          <input
            aria-label="Reason for dismissing"
            className="w-full rounded border border-line px-2 py-1 text-xs text-ink"
            placeholder="Why is this a false positive?"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <div className="flex gap-1">
            <Button
              className="px-2! py-1! text-xs!"
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
            <Button className="px-2! py-1! text-xs!" onClick={() => setDismissing(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <button type="button" className="no-print ml-3 text-mute underline" onClick={() => setDismissing(true)}>
          Dismiss as false positive
        </button>
      )}
    </div>
  );
}
