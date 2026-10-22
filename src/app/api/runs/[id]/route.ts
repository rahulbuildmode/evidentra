import { getRun } from "@/lib/server/run-recorder";
import { isSafeId } from "@/lib/uploads";

const fail = (status: number, code: string, error: string) => Response.json({ code, error }, { status });

// GET /api/runs/<runId>?workspaceId=... → one recorded run, only from that workspace's own records
export async function GET(request: Request, ctx: RouteContext<"/api/runs/[id]">) {
  const { id } = await ctx.params;
  const workspaceId = new URL(request.url).searchParams.get("workspaceId");
  if (!isSafeId(workspaceId) || !isSafeId(id)) return fail(400, "bad_request", "Missing or invalid id.");
  const run = await getRun(workspaceId, id);
  if (!run) return fail(404, "not_found", "No saved run with this id in this workspace. On the hosted demo, saved runs can disappear when the server restarts.");
  return Response.json({ run });
}
