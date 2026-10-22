import { isGeminiConfigured } from "@/lib/gemini";
import { CDSCO_MFG_BCD, getRequirementSet } from "@/lib/requirements";
import type { RunEvent } from "@/lib/run";
import { ensureDemoLoaded } from "@/lib/server/demo-loader";
import { AnalysisError } from "@/lib/server/gemini-common";
import { runExclusive } from "@/lib/server/run-lock";
import { runLivePipeline } from "@/lib/server/run-pipeline";
import { listRuns, RunRecorder } from "@/lib/server/run-recorder";
import { isSafeId } from "@/lib/uploads";

export const maxDuration = 240;

const fail = (status: number, code: string, error: string) => Response.json({ code, error }, { status });

// GET /api/runs?workspaceId=... → this workspace's recorded runs, newest first
export async function GET(request: Request) {
  const workspaceId = new URL(request.url).searchParams.get("workspaceId");
  if (!isSafeId(workspaceId)) return fail(400, "bad_request", "Missing or invalid workspace id.");
  await ensureDemoLoaded(workspaceId);
  return Response.json({ runs: await listRuns(workspaceId) });
}

/**
 * POST /api/runs { workspaceId, requirementSetId } → runs the pipeline and streams its real events as
 * Server-Sent Events (one `data:` JSON event per line, `id:` = sequence number). The run is saved when
 * it ends, so a client that loses the stream can fetch GET /api/runs/<runId> instead.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const workspaceId = body?.workspaceId;
  if (!isSafeId(workspaceId)) return fail(400, "bad_request", "Missing or invalid workspace id.");
  const set = body?.requirementSetId == null ? CDSCO_MFG_BCD : getRequirementSet(body.requirementSetId);
  if (body?.requirementSetId != null && !set) return fail(400, "bad_request", "Unknown requirement set.");
  if (!isGeminiConfigured()) return fail(503, "missing_key", "AI analysis is unavailable: GEMINI_API_KEY is not set on the server.");

  const encoder = new TextEncoder();
  let send: (e: RunEvent) => void = () => {};
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let open = true;
      send = (e) => {
        if (!open) return;
        try {
          controller.enqueue(encoder.encode(`id: ${e.seq}\ndata: ${JSON.stringify(e)}\n\n`));
        } catch {
          open = false; // client went away; the run continues and is saved
        }
      };
      const close = () => {
        if (open) controller.close();
        open = false;
      };
      runExclusive(`run:${workspaceId}`, async () => {
        await ensureDemoLoaded(workspaceId);
        const rec = new RunRecorder(workspaceId, "live", set?.id ?? null, (e) => send(e));
        try {
          await runLivePipeline(rec, workspaceId, set);
        } catch (err) {
          console.error("[runs] unexpected error", err instanceof Error ? err.message : err);
          const running = rec.run.steps.find((s) => s.status === "running");
          if (running) rec.fail(running.key, "unavailable", "This step failed unexpectedly. Earlier results are unchanged.");
          rec.skipRemaining("Not run: an earlier step failed.");
        }
        await rec.end();
      })
        .catch((err) => {
          const e = err instanceof AnalysisError ? err : new AnalysisError("unavailable", 500, "The run could not start.");
          controller.enqueue(encoder.encode(`event: error\ndata: ${JSON.stringify({ code: e.code, error: e.message })}\n\n`));
        })
        .finally(close);
    },
  });
  return new Response(stream, {
    headers: { "content-type": "text/event-stream; charset=utf-8", "cache-control": "no-cache, no-transform", "x-accel-buffering": "no" },
  });
}
