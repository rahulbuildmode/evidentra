import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { AnalysisResult } from "../analysis";
import type { MappingResult } from "../mapping";
import type { DeviceProfile, ValidationReport } from "../regulatory/types";
import { isSafeId } from "../uploads";
import { dataRoot } from "./document-store";

/** Latest successful result per workspace, stored next to the uploads (private, git-ignored). */
type Kind = "analyses" | "mappings" | "profiles" | "validations";

function file(kind: Kind, workspaceId: string): string {
  if (!isSafeId(workspaceId)) throw new Error("Invalid workspace id");
  return path.join(dataRoot(), kind, `${workspaceId}.json`);
}

async function save(kind: Kind, workspaceId: string, data: unknown): Promise<void> {
  const f = file(kind, workspaceId);
  await mkdir(path.dirname(f), { recursive: true });
  await writeFile(f, JSON.stringify(data));
}

async function load<T>(kind: Kind, workspaceId: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(file(kind, workspaceId), "utf8")) as T;
  } catch {
    return null;
  }
}

export const saveAnalysis = (r: AnalysisResult) => save("analyses", r.workspaceId, r);
export const getAnalysis = (ws: string) => load<AnalysisResult>("analyses", ws);
export const saveMapping = (r: MappingResult) => save("mappings", r.workspaceId, r);
export const getMapping = (ws: string) => load<MappingResult>("mappings", ws);

export const saveProfile = (ws: string, p: DeviceProfile) => save("profiles", ws, p);
export const getProfile = (ws: string) => load<DeviceProfile>("profiles", ws);
export const saveValidation = (r: ValidationReport) => save("validations", r.workspaceId, r);
export const getSavedValidation = (ws: string) => load<ValidationReport>("validations", ws);

export async function clearResults(workspaceId: string): Promise<void> {
  await rm(file("analyses", workspaceId), { force: true });
  await rm(file("mappings", workspaceId), { force: true });
  await rm(file("validations", workspaceId), { force: true });
}
