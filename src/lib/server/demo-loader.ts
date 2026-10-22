import { readFile, rm } from "node:fs/promises";
import path from "node:path";
import { CDSCO_MFG_BCD } from "../requirements";
import { clearResults, getAnalysis, saveAnalysis, saveProfile, saveValidation } from "./analysis-store";
import { DEMO_ANALYSIS, DEMO_FILES } from "./demo-seed";
import { dataRoot, listDocuments } from "./document-store";
import { ingestPdf } from "./ingest";
import { recordChecks, recordValidation, recordVerification, summarizeFindings } from "./run-pipeline";
import { RunRecorder } from "./run-recorder";
import { DEMO_PROFILE } from "./validation";
import { loadReadableDocuments } from "./workspace-docs";

export const DEMO_WORKSPACE_ID = "demo-workspace"; // same id as lib/demo-data.ts

/**
 * (Re)load the fictional demo dossier: real PDFs + hand-written seed whose quotes are verified by code.
 * Recorded as a "demo-seed" run: extraction, verification and checks really run (and are timed);
 * the AI steps are recorded as skipped because no AI request is made.
 */
export async function loadDemo(): Promise<{ documents: number; unverifiedQuotes: number; runId: string }> {
  const ws = DEMO_WORKSPACE_ID;
  const rec = new RunRecorder(ws, "demo-seed", CDSCO_MFG_BCD.id);
  await rm(path.join(dataRoot(), "uploads", ws), { recursive: true, force: true });
  await clearResults(ws);
  rec.start("documents", "Reading the 4 fictional PDFs in fixtures/demo-dossier (SYNTHETIC DEMO DATA)");
  rec.complete("documents", `${DEMO_FILES.length} synthetic files (not uploaded by a user)`);
  rec.start("extraction", "Extracting text page by page");
  for (const name of DEMO_FILES) {
    const bytes = new Uint8Array(await readFile(path.join(process.cwd(), "fixtures", "demo-dossier", name)));
    const meta = await ingestPdf(ws, name, bytes, "demo");
    rec.event("document_processed", "extraction", name, { id: meta.id, pages: meta.pageCount, extractMs: meta.extractMs });
  }
  const { docs, skipped } = await loadReadableDocuments(ws);
  rec.run.documents = (await listDocuments(ws)).map((m) => ({
    id: m.id,
    filename: m.filename,
    status: m.status,
    pages: m.pageCount,
    extractMs: m.extractMs ?? null,
    uploadedAt: m.uploadedAt,
    included: m.status === "extracted",
    reason: m.status === "extracted" ? null : (m.error ?? "No extractable text"),
  }));
  rec.complete("extraction", `${docs.length} documents with text`);
  rec.skip("ai_analysis", "Demo seed: results are hand-written (SYNTHETIC DEMO DATA). No AI request was made.");

  const items = recordVerification(rec, DEMO_ANALYSIS, docs, "demo");
  const now = new Date().toISOString();
  const analysis = {
    runId: "demo",
    workspaceId: ws,
    source: "demo-seed" as const,
    model: "demo seed (hand-written, not AI)",
    createdAt: now,
    documents: docs.map((d) => ({ id: d.id, filename: d.filename, pageCount: d.pageCount ?? 0, charsSent: 0, truncated: false })),
    skipped,
    items,
    usage: { promptTokens: null, outputTokens: null },
  };
  recordChecks(rec, analysis);
  rec.skip(
    "ai_mapping",
    "Demo seed: no AI request was made, so no AI evidence matching exists for the CDSCO requirements. Run Analyse dossier (uses Gemini) to add it; the validator otherwise uses code keyword search and exact checks only.",
  );
  await saveProfile(ws, { ...DEMO_PROFILE, updatedAt: now });
  const report = await recordValidation(rec, ws, { analysis, mapping: null });

  rec.start("save", "Saving demo results");
  await saveAnalysis(analysis);
  await saveValidation(report);
  summarizeFindings(rec, analysis, null);
  rec.complete("save", "Demo results saved (labelled SYNTHETIC DEMO DATA).");
  await rec.end();
  const unverifiedQuotes = items.flatMap((i) => i.citations).filter((c) => c.verifiedPage === null).length;
  return { documents: docs.length, unverifiedQuotes, runId: rec.runId };
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
