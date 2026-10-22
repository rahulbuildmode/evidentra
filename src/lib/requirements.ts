import { MDR_2017_SOURCE, MFG_LICENCE_BCD } from "./regulatory/library";
import type { Classification, Workspace } from "./types";

/**
 * Requirement library. Two kinds of set, never mixed:
 *  - "official_text": each item was checked against the text of the Medical Devices Rules, 2017
 *    as published by CDSCO, for the scenario stated in `applicability`. See REGULATORY_SOURCES.md.
 *  - "synthetic_demo": a made-up checklist for the fictional demo dossier. Not regulatory.
 */

export type RequirementVerification = "official_text" | "synthetic_demo";

export interface Requirement {
  id: string;
  title: string;
  description: string;
  expectedEvidence: string;
  /** Where the requirement comes from (rule/schedule location and PDF page). */
  sourceLocation: string;
  /** Short verbatim excerpt from the official text (official sets only). */
  officialExcerpt?: string;
}

export interface RequirementSet {
  id: string;
  name: string;
  version: string;
  verification: RequirementVerification;
  verificationNote: string;
  sourceName: string;
  sourceUrl: string;
  /** Scenario the verification covers. Outside it, rows are reference only. */
  applicability?: { classes: Classification[]; pathwayPrefix: string; description: string };
  requirements: Requirement[];
}

const MDR_PDF = MDR_2017_SOURCE.url;

/**
 * The requirement set sent to the AI evidence matcher, derived from the verified regulatory library
 * (src/lib/regulatory/library.ts) so both always use the same ids, wording and sources.
 * Items that only a person can decide are not sent.
 */
export const CDSCO_MFG_BCD: RequirementSet = {
  id: "cdsco-mdr2017-mfg-bcd",
  name: MFG_LICENCE_BCD.name,
  version: `${MFG_LICENCE_BCD.libraryVersion} (text as amended to 14 Oct 2022)`,
  verification: "official_text",
  verificationNote:
    "Each item's excerpt is checked against the cited page of the CDSCO-published Medical Devices Rules, 2017 (as amended vide GSR 777(E) dt. 14-10-2022). Amendments after that date and the online portal checklist were NOT reviewed. A selection, not the full list. Not legal advice.",
  sourceName: MFG_LICENCE_BCD.source.title,
  sourceUrl: MDR_PDF,
  applicability: {
    classes: ["Class B", "Class C", "Class D"],
    pathwayPrefix: "Manufacturing licence",
    description: MFG_LICENCE_BCD.scope,
  },
  requirements: MFG_LICENCE_BCD.requirements
    .filter((r) => r.criterion.kind !== "human_only")
    .map((r) => ({
      id: r.id,
      title: r.title,
      description: r.criterionText,
      expectedEvidence: r.evidenceNeeded,
      sourceLocation: `${r.reference} — PDF p.${r.sourcePage}`,
      officialExcerpt: r.excerpt,
    })),
};

export const SYNTHETIC_DEMO_SET: RequirementSet = {
  id: "synthetic-demo-checklist",
  name: "Synthetic demo checklist (FICTIONAL)",
  version: "demo-1",
  verification: "synthetic_demo",
  verificationNote:
    "FICTIONAL DEMO DATA. This checklist was written for the Evidentra demo dossier to show how evidence mapping works. It is not a regulatory requirement list.",
  sourceName: "Evidentra demo (fictional)",
  sourceUrl: "",
  requirements: [
    {
      id: "DEMO-01",
      title: "Device identification",
      description: "Documents name the device and its model number.",
      expectedEvidence: "A passage giving the device name and model number.",
      sourceLocation: "Synthetic demo item",
    },
    {
      id: "DEMO-02",
      title: "Intended use and patient population",
      description: "Documents state what the device is for and for whom.",
      expectedEvidence: "An intended-use statement including the patient population.",
      sourceLocation: "Synthetic demo item",
    },
    {
      id: "DEMO-03",
      title: "Product specifications",
      description: "Documents give key performance specifications.",
      expectedEvidence: "Measurement range and accuracy specifications.",
      sourceLocation: "Synthetic demo item",
    },
    {
      id: "DEMO-04",
      title: "Instructions for use match the device",
      description: "The instructions for use identify the same device and model as the device file.",
      expectedEvidence: "The IFU names the same model number as the device master file.",
      sourceLocation: "Synthetic demo item",
    },
    {
      id: "DEMO-05",
      title: "Risk analysis with controls",
      description: "Hazards are identified, controlled and residual risk is evaluated.",
      expectedEvidence: "A list of hazards plus control measures and a residual-risk evaluation.",
      sourceLocation: "Synthetic demo item",
    },
    {
      id: "DEMO-06",
      title: "Biocompatibility evaluation",
      description: "Patient-contacting materials have a biocompatibility evaluation.",
      expectedEvidence: "A biocompatibility test summary for patient-contacting materials.",
      sourceLocation: "Synthetic demo item",
    },
    {
      id: "DEMO-07",
      title: "Quality management certificate in date",
      description: "A quality management system certificate covering the manufacturer is within its validity period.",
      expectedEvidence: "A QMS certificate naming the manufacturer with a future 'valid until' date.",
      sourceLocation: "Synthetic demo item",
    },
  ],
};

export const REQUIREMENT_SETS: RequirementSet[] = [CDSCO_MFG_BCD, SYNTHETIC_DEMO_SET];

export function getRequirementSet(id: string | undefined | null): RequirementSet | null {
  return REQUIREMENT_SETS.find((s) => s.id === id) ?? null;
}

/** Is the official set applicable to what the workspace says? Null = not an official set. */
export function scenarioApplicability(
  set: RequirementSet,
  ws: Workspace,
): { applicable: boolean; reason: string; basedOnUnverifiedFields: boolean } | null {
  if (!set.applicability) return null;
  const cls = ws.classification.value as Classification;
  const classOk = set.applicability.classes.includes(cls);
  const pathOk = ws.pathway.value.startsWith(set.applicability.pathwayPrefix);
  const basedOnUnverifiedFields = !ws.classification.verified || !ws.pathway.verified;
  if (classOk && pathOk) {
    return { applicable: true, reason: `Workspace: ${cls}, ${ws.pathway.value}.`, basedOnUnverifiedFields };
  }
  return {
    applicable: false,
    reason: `Verified only for: ${set.applicability.description} The workspace says "${cls}" / "${ws.pathway.value}".`,
    basedOnUnverifiedFields,
  };
}
