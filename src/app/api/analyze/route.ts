import { geminiModel, isGeminiConfigured } from "@/lib/gemini";
import { getAnalysis, saveAnalysis } from "@/lib/server/analysis-store";
import { AnalysisError, analyzeDocuments } from "@/lib/server/gemini-analyze";
import { ensureDemoLoaded } from "@/lib/server/demo-loader";
import { runExclusive } from "@/lib/server/run-lock";
import { loadReadableDocuments } from "@/lib/server/workspace-docs";
import { isSafeId } from "@/lib/uploads";

export const maxDuration = 120;

const fail = (status: number, code: string, error: string) => Response.json({ code, error }, { status });

// GET /api/analyze?workspaceId=... → last successful analysis (or null) + whether AI is configured
export async function GET(request: Request) {
  const workspaceId = new URL(request.url).searchParams.get("workspaceId");
  if (!isSafeId(workspaceId)) return fail(400, "bad_request", "Missing or invalid workspace id.");
  await ensureDemoLoaded(workspaceId);
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
  try {
    return await runExclusive(`analyze:${workspaceId}`, async () => {
      // A fresh serverless instance may not have the demo files yet.
      await ensureDemoLoaded(workspaceId);
      const { docs, skipped } = await loadReadableDocuments(workspaceId);
      const result = await analyzeDocuments(workspaceId, docs, skipped);
      await saveAnalysis(result);
      return Response.json({ analysis: result });
    });
  } catch (err) {
    if (err instanceof AnalysisError) return fail(err.httpStatus, err.code, err.message);
    console.error("[analyze] unexpected error", err);
    return fail(500, "unavailable", "Analysis failed unexpectedly. Your documents and any earlier results are unchanged.");
  }
}
