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

const MDR_PDF =
  "https://cdsco.gov.in/opencms/resources/UploadCDSCOWeb/2022/m_device/mdr,%202017%20(1).pdf";

export const CDSCO_MFG_BCD: RequirementSet = {
  id: "cdsco-mdr2017-mfg-bcd",
  name: "MDR 2017 — documents for a Class B/C/D manufacturing licence application (selected items)",
  version: "1.0 (text as amended to 14 Oct 2022)",
  verification: "official_text",
  verificationNote:
    "Each item was checked against the CDSCO-published text of the Medical Devices Rules, 2017 \"as amended vide GSR 777(E) dt. 14-10-2022\". Amendments after that date were NOT reviewed, and the online portal checklist may add items. This is a selection, not the full list. Not legal advice.",
  sourceName: "Medical Devices Rules, 2017 (CDSCO PDF)",
  sourceUrl: MDR_PDF,
  applicability: {
    classes: ["Class B", "Class C", "Class D"],
    pathwayPrefix: "Manufacturing licence",
    description:
      "Domestic manufacturer applying for a licence to manufacture for sale or distribution of a Class B, C or D device (rules 20 and 21; Fourth Schedule, Part II, clause (ii)). Not checked for import, Class A or in vitro diagnostic devices.",
  },
  requirements: [
    {
      id: "MDR-4S-II(ii)(a)",
      title: "Constitution details of the manufacturer",
      description: "Constitution details of the domestic manufacturer must accompany the application.",
      expectedEvidence: "A document stating the legal constitution of the manufacturing firm (e.g. company type, registration, ownership).",
      sourceLocation: "Fourth Schedule, Part II, clause (ii)(a) — PDF p.100",
      officialExcerpt: "(a) Constitution details of domestic manufacturer or authorised agent.",
    },
    {
      id: "MDR-4S-II(ii)(b)",
      title: "Site or Plant Master File",
      description: "A Site or Plant Master File as specified in Appendix I of the Fourth Schedule.",
      expectedEvidence: "A Plant/Site Master File describing the manufacturing site, premises, personnel and quality system.",
      sourceLocation: "Fourth Schedule, Part II, clause (ii)(b) — PDF p.100",
      officialExcerpt: "(b) Site or plant master file as specified in Appendix I of this Schedule.",
    },
    {
      id: "MDR-4S-II(ii)(c)",
      title: "Device Master File",
      description: "A Device Master File as specified in Appendix II (devices other than IVDs).",
      expectedEvidence: "A Device Master File (or equivalent dossier) for the device, structured per Appendix II.",
      sourceLocation: "Fourth Schedule, Part II, clause (ii)(c) — PDF p.100",
      officialExcerpt: "(c) Device master file as specified in Appendix II for medical devices other than in vitro diagnostic medical devices",
    },
    {
      id: "MDR-4S-II(ii)(d)",
      title: "Essential Principles checklist",
      description: "An Essential Principles checklist demonstrating conformity to the Essential Principles of Safety and Performance.",
      expectedEvidence: "A completed checklist listing each Essential Principle with how conformity is shown.",
      sourceLocation: "Fourth Schedule, Part II, clause (ii)(d) — PDF p.100",
      officialExcerpt: "(d) Essential Principles checklist for demonstrating conformity to the Essential Principles of Safety and Performance",
    },
    {
      id: "MDR-4S-II(ii)(f)",
      title: "Undertaking on Fifth Schedule compliance",
      description: "A signed undertaking that the manufacturing site complies with the Fifth Schedule (quality management system).",
      expectedEvidence: "A signed undertaking stating the site complies with the Fifth Schedule.",
      sourceLocation: "Fourth Schedule, Part II, clause (ii)(f) — PDF p.100",
      officialExcerpt: "(f) Undertaking signed stating that the manufacturing site is in compliance with the provisions of the Fifth Schedule.",
    },
    {
      id: "MDR-4S-AppII-2.1",
      title: "DMF: general device description",
      description: "The Device Master File should give a general description including generic name, model name, model number, materials, intended use and indications.",
      expectedEvidence: "Passages stating generic name, model name/number, materials of construction and intended use.",
      sourceLocation: "Fourth Schedule, Appendix II, section 2.1(a) — PDF p.106",
      officialExcerpt: "A general description including its generic name, model name, model No., materials of construction, intended use, indications",
    },
    {
      id: "MDR-4S-AppII-3.0",
      title: "DMF: labelling (label and instructions for use)",
      description: "The Device Master File should contain a complete set of labelling, including the original label and instructions for use.",
      expectedEvidence: "A copy of the device label and the instructions for use, consistent with the device described.",
      sourceLocation: "Fourth Schedule, Appendix II, section 3.0 — PDF p.107",
      officialExcerpt: "The dossier should typically contain a complete set of labeling associated with the device",
    },
    {
      id: "MDR-4S-AppII-6.0",
      title: "DMF: risk analysis and control summary",
      description: "A summary of risks identified and how they have been controlled to an acceptable level, with the technique used.",
      expectedEvidence: "A risk summary listing hazards, the analysis technique, control measures and residual-risk acceptability.",
      sourceLocation: "Fourth Schedule, Appendix II, section 6.0 — PDF p.109",
      officialExcerpt: "a summary of the risks identified during the risk analysis process and how these risks have been controlled to an acceptable level",
    },
    {
      id: "MDR-4S-AppII-7.2",
      title: "DMF: biocompatibility",
      description: "A list of materials in contact with patient or user and, where testing was done, details of biocompatibility tests and results.",
      expectedEvidence: "A list of patient/user-contacting materials and a biocompatibility test summary (or a justified 'not applicable').",
      sourceLocation: "Fourth Schedule, Appendix II, section 7.2 — PDF p.111",
      officialExcerpt: "The dossier should contain a list of all materials in direct or indirect contact with the patient or user.",
    },
    {
      id: "MDR-4S-AppII-note3",
      title: "Certificates within validity",
      description: "All certificates submitted must be within their validity period.",
      expectedEvidence: "Each submitted certificate shows a validity date that has not passed.",
      sourceLocation: "Fourth Schedule, Appendix II, closing notes, item 3 — PDF p.114",
      officialExcerpt: "All certificates submitted must be within the validity period.",
    },
  ],
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
