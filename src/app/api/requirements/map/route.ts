import { getAnalysis, getMapping, saveMapping } from "@/lib/server/analysis-store";
import { AnalysisError } from "@/lib/server/gemini-common";
import { mapRequirements } from "@/lib/server/gemini-map";
import { ensureDemoLoaded } from "@/lib/server/demo-loader";
import { runExclusive } from "@/lib/server/run-lock";
import { loadReadableDocuments } from "@/lib/server/workspace-docs";
import { getRequirementSet } from "@/lib/requirements";
import { isSafeId } from "@/lib/uploads";

export const maxDuration = 120;

const fail = (status: number, code: string, error: string) => Response.json({ code, error }, { status });

// GET /api/requirements/map?workspaceId=... → last saved mapping (or null)
export async function GET(request: Request) {
  const workspaceId = new URL(request.url).searchParams.get("workspaceId");
  if (!isSafeId(workspaceId)) return fail(400, "bad_request", "Missing or invalid workspace id.");
  await ensureDemoLoaded(workspaceId);
  return Response.json({ mapping: await getMapping(workspaceId), hasAnalysis: (await getAnalysis(workspaceId)) !== null });
}

// POST /api/requirements/map { workspaceId, requirementSetId } → Gemini proposes evidence; code verifies
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const workspaceId = body?.workspaceId;
  const set = getRequirementSet(body?.requirementSetId);
  if (!isSafeId(workspaceId)) return fail(400, "bad_request", "Missing or invalid workspace id.");
  if (!set) return fail(400, "bad_request", "Unknown requirement set.");
  try {
    return await runExclusive(`map:${workspaceId}`, async () => {
      const { docs } = await loadReadableDocuments(workspaceId);
      const mapping = await mapRequirements(workspaceId, set, docs);
      await saveMapping(mapping);
      return Response.json({ mapping });
    });
  } catch (err) {
    if (err instanceof AnalysisError) return fail(err.httpStatus, err.code, err.message);
    console.error("[map] unexpected error", err);
    return fail(500, "unavailable", "Mapping failed unexpectedly. Earlier results are unchanged.");
  }
}
