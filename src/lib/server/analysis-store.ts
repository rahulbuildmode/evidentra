import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { AnalysisResult } from "../analysis";
import { isSafeId } from "../uploads";
import { dataRoot } from "./document-store";

/** Latest successful analysis per workspace, stored next to the uploads (private, git-ignored). */
function file(workspaceId: string): string {
  if (!isSafeId(workspaceId)) throw new Error("Invalid workspace id");
  return path.join(dataRoot(), "analyses", `${workspaceId}.json`);
}

export async function saveAnalysis(result: AnalysisResult): Promise<void> {
  const f = file(result.workspaceId);
  await mkdir(path.dirname(f), { recursive: true });
  await writeFile(f, JSON.stringify(result));
}

export async function getAnalysis(workspaceId: string): Promise<AnalysisResult | null> {
  try {
    return JSON.parse(await readFile(file(workspaceId), "utf8")) as AnalysisResult;
  } catch {
    return null;
  }
}
