import { EVIDENCE_LABEL, type MappingResult } from "./mapping";
import type { RequirementSet } from "./requirements";
import type { Decision } from "./types";

function cell(v: string | number | null | undefined): string {
  const s = String(v ?? "");
  // Prefix risky leading characters so spreadsheets don't run them as formulas.
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
}

export function evidenceMatrixCsv(
  set: RequirementSet,
  mapping: MappingResult | null,
  decisions: Record<string, Decision>,
  isDemo: boolean,
): string {
  const usable = mapping && mapping.requirementSetId === set.id ? mapping : null;
  const header = [
    "requirement_id",
    "requirement",
    "verification",
    "source",
    "expected_evidence",
    "evidence_status",
    "source_documents",
    "pages",
    "quotations",
    "quotation_checks",
    "next_action",
    "human_review",
    "mapping_source",
    "data_origin",
  ];
  const rows = set.requirements.map((r) => {
    const row = usable?.rows.find((x) => x.requirementId === r.id);
    const cites = row?.citations ?? [];
    return [
      r.id,
      r.title,
      set.verification === "official_text" ? "official text (see verification note)" : "synthetic demo (fictional)",
      r.sourceLocation,
      r.expectedEvidence,
      row ? EVIDENCE_LABEL[row.status] : "not assessed",
      cites.map((c) => c.filename).join(" | "),
      cites.map((c) => c.verifiedPage ?? "unverified").join(" | "),
      cites.map((c) => c.quote).join(" | "),
      cites.map((c) => c.check).join(" | "),
      row?.nextAction ?? "",
      decisions[`req:${set.id}:${r.id}`] ?? "undecided",
      usable ? (usable.source === "demo-seed" ? "demo seed (hand-written)" : `Gemini ${usable.model ?? ""}`) : "none",
      isDemo ? "FICTIONAL DEMO" : "user workspace",
    ]
      .map(cell)
      .join(",");
  });
  return [header.map(cell).join(","), ...rows].join("\n");
}
