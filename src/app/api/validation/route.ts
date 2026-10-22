import { connection } from "next/server";
import { ensureDemoLoaded } from "@/lib/server/demo-loader";
import { buildValidation } from "@/lib/server/validation";
import { isSafeId } from "@/lib/uploads";

const fail = (status: number, code: string, error: string) => Response.json({ code, error }, { status });

/**
 * GET /api/validation?workspaceId=... → the CDSCO validation report, prepared on the server from this
 * workspace's stored text, saved analysis/mapping and device profile (recomputed on each request so it
 * reflects the current profile and documents; runs also save the report they produced).
 */
export async function GET(request: Request) {
  await connection();
  const workspaceId = new URL(request.url).searchParams.get("workspaceId");
  if (!isSafeId(workspaceId)) return fail(400, "bad_request", "Missing or invalid workspace id.");
  await ensureDemoLoaded(workspaceId);
  try {
    return Response.json({ report: await buildValidation(workspaceId) });
  } catch (err) {
    console.error("[validation] failed", err instanceof Error ? err.message : err);
    return fail(500, "unavailable", "The validation report could not be prepared.");
  }
}
