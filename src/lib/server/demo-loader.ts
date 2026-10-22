import { readFile, rm } from "node:fs/promises";
import path from "node:path";
import { SYNTHETIC_DEMO_SET } from "../requirements";
import { clearResults, getAnalysis, saveAnalysis, saveMapping } from "./analysis-store";
import { DEMO_ANALYSIS, DEMO_FILES, DEMO_MAPPING } from "./demo-seed";
import { dataRoot, listDocuments } from "./document-store";
import { toItems } from "./gemini-analyze";
import { finalizeRows } from "./gemini-map";
import { ingestPdf } from "./ingest";
import { loadReadableDocuments } from "./workspace-docs";

export const DEMO_WORKSPACE_ID = "demo-workspace"; // same id as lib/demo-data.ts

/** (Re)load the fictional demo dossier: real PDFs + hand-written seed whose quotes are verified by code. */
export async function loadDemo(): Promise<{ documents: number; unverifiedQuotes: number }> {
  const ws = DEMO_WORKSPACE_ID;
  await rm(path.join(dataRoot(), "uploads", ws), { recursive: true, force: true });
  await clearResults(ws);
  for (const name of DEMO_FILES) {
    const bytes = new Uint8Array(await readFile(path.join(process.cwd(), "fixtures", "demo-dossier", name)));
    await ingestPdf(ws, name, bytes, "demo");
  }
  const { docs, skipped } = await loadReadableDocuments(ws);
  const now = new Date().toISOString();
  const items = toItems(DEMO_ANALYSIS, docs, "demo");
  await saveAnalysis({
    runId: "demo",
    workspaceId: ws,
    source: "demo-seed",
    model: "demo seed (hand-written, not AI)",
    createdAt: now,
    documents: docs.map((d) => ({ id: d.id, filename: d.filename, pageCount: d.pageCount ?? 0, charsSent: 0, truncated: false })),
    skipped,
    items,
    usage: { promptTokens: null, outputTokens: null },
  });
  const rows = finalizeRows(SYNTHETIC_DEMO_SET, DEMO_MAPPING, docs);
  await saveMapping({
    runId: "demo",
    workspaceId: ws,
    requirementSetId: SYNTHETIC_DEMO_SET.id,
    source: "demo-seed",
    model: null,
    createdAt: now,
    documents: docs.map((d) => d.filename),
    rows,
  });
  const unverifiedQuotes =
    items.flatMap((i) => i.citations).filter((c) => c.verifiedPage === null).length +
    rows.flatMap((r) => r.citations).filter((c) => c.verifiedPage === null).length;
  return { documents: docs.length, unverifiedQuotes };
}

let seeding: Promise<unknown> | null = null;

/**
 * On a fresh server (e.g. a new Vercel instance with an empty /tmp) the demo workspace has no
 * files. Seed it lazily so the demo still works. Never re-seeds once results exist, so a user who
 * removed demo files does not see them reappear on the same instance.
 */
export async function ensureDemoLoaded(workspaceId: string): Promise<void> {
  if (workspaceId !== DEMO_WORKSPACE_ID) return;
  if ((await listDocuments(workspaceId)).length > 0 || (await getAnalysis(workspaceId))) return;
  seeding ??= loadDemo()
    .catch((e) => console.error("[demo] lazy seed failed", e))
    .finally(() => (seeding = null));
  await seeding;
}
