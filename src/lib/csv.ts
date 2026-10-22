import { REQUIREMENTS } from "./requirements";
import type { AppState } from "./types";

function cell(v: string | number | undefined): string {
  const s = String(v ?? "");
  // Prefix risky leading characters so spreadsheets don't run them as formulas.
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
}

export function evidenceMatrixCsv(state: AppState): string {
  const header = [
    "requirement_id",
    "requirement",
    "suggested_status",
    "filename",
    "page",
    "quote",
    "note",
    "human_decision",
    "requirement_verified_against_official_text",
    "data_origin",
  ];
  const rows = REQUIREMENTS.map((r) => {
    const ev = state.evidence.find((e) => e.requirementId === r.id);
    return [
      r.id,
      r.title,
      ev?.suggestedStatus ?? "not_analysed",
      ev?.filename ?? "",
      ev?.page ?? "",
      ev?.quote ?? "",
      ev?.note ?? "No analysis has been run for this workspace.",
      state.decisions[r.id] ?? "undecided",
      r.verifiedAgainstOfficialText ? "yes" : "no",
      state.isDemo ? "FICTIONAL DEMO" : "user workspace",
    ]
      .map(cell)
      .join(",");
  });
  return [header.map(cell).join(","), ...rows].join("\n");
}
