import { getProfile, saveProfile } from "@/lib/server/analysis-store";
import { ensureDemoLoaded } from "@/lib/server/demo-loader";
import { loadProfile, ProfileInputSchema } from "@/lib/server/validation";
import { DEMO_WORKSPACE_ID } from "@/lib/demo-data";
import { isSafeId } from "@/lib/uploads";

const fail = (status: number, code: string, error: string) => Response.json({ code, error }, { status });

// GET /api/profile?workspaceId=... → the device and pathway profile used for CDSCO validation
export async function GET(request: Request) {
  const workspaceId = new URL(request.url).searchParams.get("workspaceId");
  if (!isSafeId(workspaceId)) return fail(400, "bad_request", "Missing or invalid workspace id.");
  await ensureDemoLoaded(workspaceId);
  return Response.json({ profile: await loadProfile(workspaceId), saved: (await getProfile(workspaceId)) !== null });
}

// PUT /api/profile { workspaceId, profile } → validated and stored per workspace
export async function PUT(request: Request) {
  const body = await request.json().catch(() => null);
  const workspaceId = body?.workspaceId;
  if (!isSafeId(workspaceId)) return fail(400, "bad_request", "Missing or invalid workspace id.");
  const parsed = ProfileInputSchema.safeParse(body?.profile);
  if (!parsed.success) return fail(400, "bad_request", `Invalid device profile: ${parsed.error.issues[0]?.path.join(".")} ${parsed.error.issues[0]?.message}`);
  const p = parsed.data;
  // A class cannot be "confirmed" while unknown.
  const profile = {
    ...p,
    riskClassConfirmed: p.riskClass !== "unknown" && p.riskClassConfirmed,
    origin: workspaceId === DEMO_WORKSPACE_ID ? ("demo" as const) : ("user" as const),
    updatedAt: new Date().toISOString(),
  };
  await saveProfile(workspaceId, profile);
  return Response.json({ profile });
}
