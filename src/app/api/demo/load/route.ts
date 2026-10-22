import { readFile, rm } from "node:fs/promises";
import path from "node:path";
import { SYNTHETIC_DEMO_SET } from "@/lib/requirements";
import { clearResults, saveAnalysis, saveMapping } from "@/lib/server/analysis-store";
import { DEMO_ANALYSIS, DEMO_FILES, DEMO_MAPPING } from "@/lib/server/demo-seed";
import { dataRoot } from "@/lib/server/document-store";
import { toItems } from "@/lib/server/gemini-analyze";
import { finalizeRows } from "@/lib/server/gemini-map";
import { ingestPdf } from "@/lib/server/ingest";
import { loadReadableDocuments } from "@/lib/server/workspace-docs";

const DEMO_WORKSPACE_ID = "demo-workspace"; // same as DEMO_WORKSPACE_ID in lib/demo-data.ts

// POST /api/demo/load → (re)load the fictional demo dossier into the demo workspace.
// The seed's facts and evidence are hand-written, then every quotation is verified against the PDFs.
export async function POST() {
  const ws = DEMO_WORKSPACE_ID;
  try {
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

    const unverified =
      items.flatMap((i) => i.citations).filter((c) => c.verifiedPage === null).length +
      rows.flatMap((r) => r.citations).filter((c) => c.verifiedPage === null).length;
    return Response.json({ ok: true, documents: docs.length, unverifiedQuotes: unverified });
  } catch (err) {
    console.error("[demo] load failed", err);
    return Response.json({ error: "The demo dossier could not be loaded." }, { status: 500 });
  }
}
