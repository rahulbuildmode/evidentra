/**
 * Mission tasks and achievements, computed only from real application state: server-extracted
 * documents, the saved analysis, the device profile, human reviews and the user's action log.
 * No points, scores or timers. Completing every task does not mean the device is compliant.
 */
import type { CaseLog } from "./case-log";

export interface CaseInputs {
  readableDocs: number;
  pathwayInScope: boolean;
  analysis: { source: "gemini" | "demo-seed"; runId: string } | null;
  leads: { key: string; reviewed: boolean }[];
  /** Requirement checks that need a human decision (conflicts, potential gaps, needs review). */
  checks: { id: string; reviewed: boolean }[];
  log: CaseLog;
}

export interface MissionTask {
  id: "intake" | "pathway" | "scan" | "inspect" | "leads" | "checks" | "export";
  title: string;
  done: boolean;
  detail: string;
}

export interface Achievement {
  id: string;
  title: string;
  earnedFor: string;
  earned: boolean;
}

export function missionTasks(c: CaseInputs): MissionTask[] {
  const leadsReviewed = c.leads.filter((l) => l.reviewed).length;
  const checksReviewed = c.checks.filter((x) => x.reviewed).length;
  return [
    {
      id: "intake",
      title: "Add evidence",
      done: c.readableDocs > 0,
      detail: c.readableDocs > 0 ? `${c.readableDocs} document${c.readableDocs === 1 ? "" : "s"} with extracted text` : "Upload the dossier's PDFs",
    },
    {
      id: "pathway",
      title: "Confirm device and pathway",
      done: c.pathwayInScope,
      detail: c.pathwayInScope ? "Pathway decided by code from the profile" : "Fill in the device and pathway details",
    },
    {
      id: "scan",
      title: "Run the scan",
      done: c.analysis !== null,
      detail: !c.analysis ? "Analyse the dossier" : c.analysis.source === "demo-seed" ? "Demo seed loaded — no AI scan run" : `AI analysis ${c.analysis.runId}`,
    },
    {
      id: "inspect",
      title: "Check a source quotation",
      done: Boolean(c.log.inspectedVerifiedQuote),
      detail: c.log.inspectedVerifiedQuote
        ? `Opened ${c.log.inspectedVerifiedQuote.filename}, p.${c.log.inspectedVerifiedQuote.page ?? "?"}`
        : "Open a verified quotation on its source page",
    },
    {
      id: "leads",
      title: "Review every lead",
      done: c.analysis !== null && leadsReviewed === c.leads.length,
      detail: !c.analysis ? "Available after the scan" : c.leads.length === 0 ? "No leads found" : `${leadsReviewed} of ${c.leads.length} reviewed`,
    },
    {
      id: "checks",
      title: "Review requirement checks",
      done: c.checks.length > 0 && checksReviewed === c.checks.length,
      detail: c.checks.length === 0 ? "None need a decision" : `${checksReviewed} of ${c.checks.length} reviewed`,
    },
    {
      id: "export",
      title: "Export the case summary",
      done: Boolean(c.log.exported),
      detail: c.log.exported ? `Exported (${c.log.exported.kind === "csv" ? "CSV" : "print / PDF"})` : "Print or download the summary",
    },
  ];
}

export function achievements(c: CaseInputs): Achievement[] {
  const reviewedLeads = c.leads.filter((l) => l.reviewed).length;
  return [
    { id: "first-evidence", title: "Evidence logged", earnedFor: "A document's text was extracted by the server", earned: c.readableDocs > 0 },
    { id: "scan", title: "Scan complete", earnedFor: "A live AI analysis finished and its quotations were checked", earned: c.analysis?.source === "gemini" },
    { id: "source", title: "Source verified", earnedFor: "You opened a code-verified quotation on its source page", earned: Boolean(c.log.inspectedVerifiedQuote) },
    { id: "first-lead", title: "First lead closed", earnedFor: "You reviewed a lead", earned: reviewedLeads > 0 },
    { id: "board", title: "Board cleared", earnedFor: "You reviewed every lead", earned: c.leads.length > 0 && reviewedLeads === c.leads.length },
    {
      id: "checklist",
      title: "Checklist complete",
      earnedFor: "You reviewed every requirement check that needed a decision",
      earned: c.checks.length > 0 && c.checks.every((x) => x.reviewed),
    },
    { id: "filed", title: "Case filed", earnedFor: "You exported the case summary", earned: Boolean(c.log.exported) },
  ];
}
