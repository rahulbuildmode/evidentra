import { z } from "zod";
import type { AnalysisResult } from "../analysis";
import { todayISO } from "../checks";
import type { MappingResult } from "../mapping";
import { DEMO_WORKSPACE_ID } from "../demo-data";
import { MFG_LICENCE_BCD, PULSE_OXIMETER_CLASSIFICATION } from "../regulatory/library";
import { EMPTY_PROFILE, type DeviceProfile, type ValidationReport } from "../regulatory/types";
import { validateDossier } from "../regulatory/validate";
import { getAnalysis, getMapping, getProfile } from "./analysis-store";
import { loadReadableDocuments } from "./workspace-docs";

/** Fictional profile for the synthetic demo dossier. The class is entered, not confirmed. */
export const DEMO_PROFILE: DeviceProfile = {
  deviceName: "AuraPulse Fingertip Pulse Oximeter (fictional)",
  intendedUse: "Spot-check, non-invasive measurement of functional oxygen saturation (SpO2) and pulse rate in adults (fictional demo).",
  manufacturer: "Fictional MedTech Pvt Ltd (fictional)",
  deviceCategory: "Pulse oximeter (fictional demo device)",
  riskClass: "C",
  riskClassConfirmed: false,
  riskClassBasis: `Category "pulse oximeter" is listed as Class C in the ${PULSE_OXIMETER_CLASSIFICATION.source}. The device is fictional, so a person must still confirm the class.`,
  activity: "manufacture",
  ivd: "no",
  licenceType: "licence",
  testLicence: "unknown",
  origin: "demo",
  updatedAt: null,
};

const text = (max: number) => z.string().max(max).transform((s) => s.trim());
export const ProfileInputSchema = z.object({
  deviceName: text(200),
  intendedUse: text(1000),
  manufacturer: text(200),
  deviceCategory: text(200),
  riskClass: z.enum(["A", "B", "C", "D", "unknown"]),
  riskClassConfirmed: z.boolean(),
  riskClassBasis: text(500),
  activity: z.enum(["manufacture", "import", "unknown"]),
  ivd: z.enum(["yes", "no", "unknown"]),
  licenceType: z.enum(["licence", "loan_licence", "unknown"]),
  testLicence: z.enum(["yes", "no", "unknown"]),
});

export async function loadProfile(workspaceId: string): Promise<DeviceProfile> {
  const saved = await getProfile(workspaceId);
  if (saved) return saved;
  return workspaceId === DEMO_WORKSPACE_ID ? DEMO_PROFILE : EMPTY_PROFILE;
}

/**
 * Server-side report preparation: the validation engine run on the workspace's stored text,
 * quote-verified analysis and mapping. `override` lets the pipeline validate results it has just produced.
 */
export async function buildValidation(
  workspaceId: string,
  override?: { analysis?: AnalysisResult | null; mapping?: MappingResult | null },
): Promise<ValidationReport> {
  const [profile, { docs, skipped }] = await Promise.all([loadProfile(workspaceId), loadReadableDocuments(workspaceId)]);
  const analysis = override && "analysis" in override ? (override.analysis ?? null) : await getAnalysis(workspaceId);
  const mapping = override && "mapping" in override ? (override.mapping ?? null) : await getMapping(workspaceId);
  return validateDossier({
    workspaceId,
    pathway: MFG_LICENCE_BCD,
    profile,
    docs: docs.map((d) => ({ filename: d.filename, pages: d.pages, synthetic: d.origin === "demo" })),
    skipped,
    analysis,
    mapping,
    today: todayISO(),
  });
}
