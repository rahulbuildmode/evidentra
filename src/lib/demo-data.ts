import type { AppState, Workspace } from "./types";

/**
 * Everything in this file is FICTIONAL. It is not a real company, device or certificate.
 * The demo dossier PDFs live in fixtures/demo-dossier and are loaded by POST /api/demo/load.
 */
export const DEMO_LABEL = "FICTIONAL DEMO DATA — not a real device, company or certificate";

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

export const DEMO_WORKSPACE_ID = "demo-workspace";

export const DEMO_STATE: AppState = {
  workspaceId: DEMO_WORKSPACE_ID,
  isDemo: true,
  workspace: DEMO_WORKSPACE,
  requirementSetId: "synthetic-demo-checklist",
  decisions: {},
};

export const BLANK_STATE: AppState = {
  workspaceId: "blank-workspace",
  isDemo: false,
  workspace: BLANK_WORKSPACE,
  requirementSetId: "cdsco-mdr2017-mfg-bcd",
  decisions: {},
};
