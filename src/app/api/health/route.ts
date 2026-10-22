import { connection } from "next/server";
import { geminiFallbackModels, geminiModel, getGeminiClient, isGeminiConfigured } from "@/lib/gemini";
import { toApiError } from "@/lib/server/gemini-common";

/**
 * GET /api/health → whether the server has a Gemini key (never the key itself), which model and
 * which deployment environment. GET /api/health?probe=1 also asks Gemini for the model's metadata
 * (no text generation) to check that the key is accepted and the API is reachable.
 */
export async function GET(request: Request) {
  await connection(); // read env at request time, not at build time
  const aiConfigured = isGeminiConfigured();
  const base = {
    ok: true,
    aiConfigured,
    keyVariable: "GEMINI_API_KEY",
    model: geminiModel(),
    fallbackModels: geminiFallbackModels(),
    environment: process.env.VERCEL_ENV ?? (process.env.NODE_ENV === "production" ? "production (local)" : "development"),
  };
  if (new URL(request.url).searchParams.get("probe") !== "1") return Response.json(base);
  if (!aiConfigured) return Response.json({ ...base, probe: { ok: false, code: "missing_key", message: "GEMINI_API_KEY is not set for this deployment environment." } });
  const t0 = performance.now();
  try {
    await getGeminiClient(15_000).models.get({ model: geminiModel() });
    return Response.json({ ...base, probe: { ok: true, code: "ok", message: "Key accepted; model metadata returned.", ms: Math.round(performance.now() - t0) } });
  } catch (err) {
    const e = toApiError(err);
    return Response.json({ ...base, probe: { ok: false, code: e.code, message: e.message, ms: Math.round(performance.now() - t0) } });
  }
}
