import type { AnalysisResult } from "../analysis";
import type { MappingResult } from "../mapping";
import type { DeviceProfile, ValidationReport } from "../regulatory/types";
import { isSafeId } from "../uploads";
import { readJson, storage, writeJson } from "./storage";

/** Latest successful result per workspace, stored next to the uploads (private; see storage.ts). */
type Kind = "analyses" | "mappings" | "profiles" | "validations";

function key(kind: Kind, workspaceId: string): string {
  if (!isSafeId(workspaceId)) throw new Error("Invalid workspace id");
  return `${kind}/${workspaceId}.json`;
}

const save = (kind: Kind, workspaceId: string, data: unknown) => writeJson(key(kind, workspaceId), data);
const load = <T>(kind: Kind, workspaceId: string) => readJson<T>(key(kind, workspaceId));

export const saveAnalysis = (r: AnalysisResult) => save("analyses", r.workspaceId, r);
export const getAnalysis = (ws: string) => load<AnalysisResult>("analyses", ws);
export const saveMapping = (r: MappingResult) => save("mappings", r.workspaceId, r);
export const getMapping = (ws: string) => load<MappingResult>("mappings", ws);

export const saveProfile = (ws: string, p: DeviceProfile) => save("profiles", ws, p);
export const getProfile = (ws: string) => load<DeviceProfile>("profiles", ws);
export const saveValidation = (r: ValidationReport) => save("validations", r.workspaceId, r);
export const getSavedValidation = (ws: string) => load<ValidationReport>("validations", ws);

export async function clearResults(workspaceId: string): Promise<void> {
  await storage().remove((["analyses", "mappings", "validations"] as Kind[]).map((k) => key(k, workspaceId)));
}
