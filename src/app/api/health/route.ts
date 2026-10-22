import { connection } from "next/server";
import { isGeminiConfigured } from "@/lib/gemini";

// Reports only whether a key exists. It never returns the key itself.
export async function GET() {
  await connection(); // read env at request time, not at build time
  return Response.json({ ok: true, aiConfigured: isGeminiConfigured() });
}
