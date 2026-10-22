import type { AppState, DocumentRecord, EvidenceLink, Fact, Workspace } from "./types";

/** Everything in this file is FICTIONAL. It is not a real company, device or certificate. */
export const DEMO_LABEL = "FICTIONAL DEMO DATA — not a real device, company or certificate";

const ADDED = "2026-10-22T00:00:00.000Z";

export const DEMO_WORKSPACE: Workspace = {
  deviceName: { value: "AuraPulse Fingertip Pulse Oximeter (fictional)", verified: false },
  manufacturer: { value: "Fictional MedTech Pvt Ltd", verified: false },
  modelNumber: { value: "AP-200A", verified: false },
  intendedUse: {
    value:
      "Fictional example: spot-check, non-invasive measurement of oxygen saturation and pulse rate.",
    verified: false,
  },
  classification: { value: "Class B", verified: false },
  pathway: { value: "Manufacturing licence — Class A/B (State Licensing Authority)", verified: false },
};

export const BLANK_WORKSPACE: Workspace = {
  deviceName: { value: "", verified: false },
  manufacturer: { value: "", verified: false },
  modelNumber: { value: "", verified: false },
  intendedUse: { value: "", verified: false },
  classification: { value: "Not yet classified", verified: false },
  pathway: { value: "Not yet decided", verified: false },
};

const doc = (
  id: string,
  filename: string,
  title: string,
  pages: number,
): DocumentRecord => ({
  id,
  filename,
  title,
  source: "demo",
  pages,
  sizeBytes: null,
  addedAt: ADDED,
  status: "demo-seeded",
});

export const DEMO_DOCUMENTS: DocumentRecord[] = [
  doc("d1", "device_description_AP-200A.pdf", "Device description", 4),
  doc("d2", "instructions_for_use_AP-200A.pdf", "Instructions for use", 6),
  doc("d3", "iso13485_sample_certificate.pdf", "Sample QMS certificate", 1),
  doc("d4", "risk_management_summary.pdf", "Risk management summary", 5),
  doc("d5", "essential_principles_checklist.pdf", "Essential Principles checklist", 3),
];

const fact = (
  id: string,
  d: DocumentRecord,
  field: Fact["field"],
  value: string,
  quote: string,
  page: number,
): Fact => ({
  id,
  documentId: d.id,
  field,
  value,
  quote,
  filename: d.filename,
  page,
  source: "demo",
});

const [d1, d2, d3, d4, d5] = DEMO_DOCUMENTS;

export const DEMO_FACTS: Fact[] = [
  fact("f1", d1, "manufacturer_name", "Fictional MedTech Pvt Ltd", "Manufacturer: Fictional MedTech Pvt Ltd", 1),
  fact("f2", d1, "device_name", "AuraPulse Fingertip Pulse Oximeter", "Device name: AuraPulse Fingertip Pulse Oximeter", 1),
  fact("f3", d1, "model_number", "AP-200A", "Model number: AP-200A", 1),
  fact("f4", d2, "manufacturer_name", "Fictional MedTech Pvt Ltd", "Manufactured by Fictional MedTech Pvt Ltd", 1),
  fact("f5", d2, "model_number", "AP-2000A", "Model: AP-2000A — read this manual before use", 1),
  fact("f6", d3, "manufacturer_name", "Fictional MedTech Pvt. Ltd.", "Issued to: Fictional MedTech Pvt. Ltd.", 1),
  fact("f7", d3, "certificate_number", "FICT-QMS-0001", "Certificate No. FICT-QMS-0001 (sample)", 1),
  fact("f8", d3, "certificate_expiry_date", "2025-03-31", "Valid until: 2025-03-31", 1),
  fact("f9", d4, "model_number", "AP-200A", "Product under assessment: AP-200A", 1),
  fact("f10", d5, "model_number", "AP-200A", "Device model AP-200A", 1),
];

export const DEMO_EVIDENCE: EvidenceLink[] = [
  {
    requirementId: "R-01",
    suggestedStatus: "partial",
    filename: d1.filename,
    page: 2,
    quote: "This document describes the design and components of the AP-200A.",
    note: "Demo-seeded suggestion: a device description exists, but no document is titled as a Device Master File.",
  },
  {
    requirementId: "R-02",
    suggestedStatus: "not_found",
    note: "Not found in the uploaded documents.",
  },
  {
    requirementId: "R-03",
    suggestedStatus: "found",
    filename: d5.filename,
    page: 1,
    quote: "Essential Principles checklist for the AP-200A (fictional).",
    note: "Demo-seeded suggestion: a checklist document is present. A human must confirm its content.",
  },
  {
    requirementId: "R-04",
    suggestedStatus: "partial",
    filename: d3.filename,
    page: 1,
    quote: "Valid until: 2025-03-31",
    note: "Demo-seeded suggestion: a QMS certificate is present but its stated validity date has passed.",
  },
  {
    requirementId: "R-05",
    suggestedStatus: "found",
    filename: d2.filename,
    page: 1,
    quote: "Model: AP-2000A — read this manual before use",
    note: "Demo-seeded suggestion: instructions for use exist, but they cite a different model number.",
  },
  {
    requirementId: "R-06",
    suggestedStatus: "not_found",
    note: "Not found in the uploaded documents. The official portal checklist is not part of this demo.",
  },
];

export const DEMO_WORKSPACE_ID = "demo-workspace";

export const DEMO_STATE: AppState = {
  workspaceId: DEMO_WORKSPACE_ID,
  isDemo: true,
  workspace: DEMO_WORKSPACE,
  documents: DEMO_DOCUMENTS,
  facts: DEMO_FACTS,
  evidence: DEMO_EVIDENCE,
  decisions: {},
};

export const BLANK_STATE: AppState = {
  workspaceId: "blank-workspace",
  isDemo: false,
  workspace: BLANK_WORKSPACE,
  documents: [],
  facts: [],
  evidence: [],
  decisions: {},
};
