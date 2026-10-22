import { readFile } from "node:fs/promises";
import path from "node:path";
import { CDSCO_MFG_BCD } from "../requirements";
import { clearResults, getAnalysis, saveAnalysis, saveProfile, saveValidation } from "./analysis-store";
import { DEMO_ANALYSIS, DEMO_FILES } from "./demo-seed";
import { clearDocuments, getDocument, hasDocuments } from "./document-store";
import { ingestPdf } from "./ingest";
import { recordChecks, recordValidation, recordVerification, summarizeFindings } from "./run-pipeline";
import { RunRecorder } from "./run-recorder";
import { DEMO_PROFILE } from "./validation";

export const DEMO_WORKSPACE_ID = "demo-workspace"; // same id as lib/demo-data.ts

/**
 * (Re)load the fictional demo dossier: real PDFs + hand-written seed whose quotes are verified by code.
 * Recorded as a "demo-seed" run: extraction, verification and checks really run (and are timed);
 * the AI steps are recorded as skipped because no AI request is made.
 */
export async function loadDemo(): Promise<{ documents: number; unverifiedQuotes: number; runId: string }> {
  const ws = DEMO_WORKSPACE_ID;
  const rec = new RunRecorder(ws, "demo-seed", CDSCO_MFG_BCD.id);
  await Promise.all([clearDocuments(ws), clearResults(ws)]);
  rec.start("documents", "Reading the 4 fictional PDFs in fixtures/demo-dossier (SYNTHETIC DEMO DATA)");
  rec.complete("documents", `${DEMO_FILES.length} synthetic files (not uploaded by a user)`);
  rec.start("extraction", "Extracting text page by page");
  // The four files are independent: read, extract and store them in parallel.
  const metas = await Promise.all(
    DEMO_FILES.map(async (name) => {
      const bytes = new Uint8Array(await readFile(path.join(process.cwd(), "fixtures", "demo-dossier", name)));
      return ingestPdf(ws, name, bytes, "demo", `demo-${name.slice(0, 2)}`);
    }),
  );
  for (const meta of metas) rec.event("document_processed", "extraction", meta.filename, { id: meta.id, pages: meta.pageCount, extractMs: meta.extractMs });
  // Just written, so read back from this instance's cache instead of listing storage again.
  const docs = (await Promise.all(metas.filter((m) => m.status === "extracted").map((m) => getDocument(ws, m.id)))).filter((d) => d !== null);
  const skipped = metas.filter((m) => m.status !== "extracted").map((m) => ({ filename: m.filename, reason: m.error ?? "No extractable text" }));
  rec.run.documents = metas.map((m) => ({
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
  demoConfirmedAt = Date.now();
  const unverifiedQuotes = items.flatMap((i) => i.citations).filter((c) => c.verifiedPage === null).length;
  return { documents: docs.length, unverifiedQuotes, runId: rec.runId };
}

let seeding: Promise<unknown> | null = null;
/** When this instance last confirmed the demo exists; the check is skipped for a few minutes after. */
let demoConfirmedAt = 0;
const DEMO_CHECK_TTL_MS = 5 * 60_000;

/**
 * If the demo workspace is empty (a fresh deployment or storage), seed it lazily so the demo still
 * works. Never re-seeds once results exist, so a user who removed demo files does not see them
 * reappear. Each instance re-checks at most every few minutes (one storage listing).
 */
export async function ensureDemoLoaded(workspaceId: string): Promise<void> {
  if (workspaceId !== DEMO_WORKSPACE_ID) return;
  if (Date.now() - demoConfirmedAt < DEMO_CHECK_TTL_MS) return;
  if ((await hasDocuments(workspaceId)) || (await getAnalysis(workspaceId))) {
    demoConfirmedAt = Date.now();
    return;
  }
  seeding ??= loadDemo()
    .then(() => (demoConfirmedAt = Date.now()))
    .catch((e) => console.error("[demo] lazy seed failed", e))
    .finally(() => (seeding = null));
  await seeding;
}
