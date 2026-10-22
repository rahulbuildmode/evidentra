import type { Requirement } from "./types";

export const REQUIREMENT_SET = {
  id: "cdsco-mdr-2017-demo-subset",
  version: "0.1-draft",
  name: "CDSCO MDR 2017 — manufacturing dossier (demo subset)",
  status:
    "DRAFT — topics were taken from CDSCO's public FAQ (CDSCO/FAQ/MD/01/2024). Not yet verified against the official Rules text. No clause numbers are asserted.",
} as const;

const FAQ_URL =
  "https://cdsco.gov.in/opencms/export/sites/CDSCO_WEB/Pdf-documents/MDfAq24.pdf";

export const REQUIREMENTS: Requirement[] = [
  {
    id: "R-01",
    title: "Device Master File",
    description:
      "A device master file is referred to in CDSCO's FAQ as part of the documents held for a device.",
    sourceName: "CDSCO FAQ (2024), Q95 context",
    sourceUrl: FAQ_URL,
    verifiedAgainstOfficialText: false,
  },
  {
    id: "R-02",
    title: "Plant Master File / Site Master File",
    description:
      "CDSCO's FAQ states the contents of the PMF/SMF are prescribed in Appendix I of the Fourth Schedule of MDR 2017.",
    sourceName: "CDSCO FAQ (2024), Q9",
    sourceUrl: FAQ_URL,
    verifiedAgainstOfficialText: false,
  },
  {
    id: "R-03",
    title: "Essential Principles of safety and performance",
    description:
      "CDSCO's FAQ states the Essential Principles apply to all risk classes of medical devices.",
    sourceName: "CDSCO FAQ (2024), Q10",
    sourceUrl: FAQ_URL,
    verifiedAgainstOfficialText: false,
  },
  {
    id: "R-04",
    title: "Quality Management System (Fifth Schedule)",
    description:
      "CDSCO's FAQ refers to a Quality Management System as prescribed in the Fifth Schedule of MDR 2017.",
    sourceName: "CDSCO FAQ (2024), Q101",
    sourceUrl: FAQ_URL,
    verifiedAgainstOfficialText: false,
  },
  {
    id: "R-05",
    title: "Labelling and instructions for use",
    description:
      "CDSCO's FAQ refers to complying with the labelling requirements under MDR 2017.",
    sourceName: "CDSCO FAQ (2024), labelling answers",
    sourceUrl: FAQ_URL,
    verifiedAgainstOfficialText: false,
  },
  {
    id: "R-06",
    title: "Essential documents per the online portal checklist",
    description:
      "CDSCO's FAQ states essential documents follow the checklist on the Medical Devices Online portal for each application form.",
    sourceName: "CDSCO FAQ (2024), Q12",
    sourceUrl: FAQ_URL,
    verifiedAgainstOfficialText: false,
  },
];
