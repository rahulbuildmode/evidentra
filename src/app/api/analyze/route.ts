import { geminiModel, isGeminiConfigured } from "@/lib/gemini";
import { getAnalysis, saveAnalysis } from "@/lib/server/analysis-store";
import { getDocument, listDocuments } from "@/lib/server/document-store";
import { AnalysisError, analyzeDocuments } from "@/lib/server/gemini-analyze";
import { isSafeId, type UploadedDocument } from "@/lib/uploads";

export const maxDuration = 120;

// Stops double-clicks from starting two paid requests for the same workspace.
const running = new Set<string>();

const fail = (status: number, code: string, error: string) => Response.json({ code, error }, { status });

// GET /api/analyze?workspaceId=... → last successful analysis (or null) + whether AI is configured
export async function GET(request: Request) {
  const workspaceId = new URL(request.url).searchParams.get("workspaceId");
  if (!isSafeId(workspaceId)) return fail(400, "bad_request", "Missing or invalid workspace id.");
  return Response.json({
    aiConfigured: isGeminiConfigured(),
    model: geminiModel(),
    analysis: await getAnalysis(workspaceId),
  });
}

// POST /api/analyze { workspaceId } → run Gemini on this workspace's extracted text
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const workspaceId = body?.workspaceId;
  if (!isSafeId(workspaceId)) return fail(400, "bad_request", "Missing or invalid workspace id.");
  if (running.has(workspaceId)) return fail(409, "busy", "An analysis is already running for this workspace.");

  running.add(workspaceId);
  try {
    const metas = await listDocuments(workspaceId);
    const docs: UploadedDocument[] = [];
    const skipped: { filename: string; reason: string }[] = [];
    for (const m of metas) {
      if (m.status !== "extracted") {
        skipped.push({ filename: m.filename, reason: m.status === "needs_ocr" ? "no extractable text (needs OCR)" : "extraction failed" });
        continue;
      }
      const d = await getDocument(workspaceId, m.id);
      if (d) docs.push(d);
    }
    const result = await analyzeDocuments(workspaceId, docs, skipped);
    await saveAnalysis(result);
    return Response.json({ analysis: result });
  } catch (err) {
    if (err instanceof AnalysisError) return fail(err.httpStatus, err.code, err.message);
    console.error("[analyze] unexpected error", err);
    return fail(500, "unavailable", "Analysis failed unexpectedly. Your documents and any earlier results are unchanged.");
  } finally {
    running.delete(workspaceId);
  }
}
