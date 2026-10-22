import { isGeminiConfigured } from "@/lib/gemini";

// Placeholder for the next build step (Gemini fact extraction + evidence suggestions).
// It deliberately returns no findings so nothing can be fabricated.
export async function POST() {
  return Response.json(
    {
      error: "AI analysis is not enabled in this build yet.",
      aiConfigured: isGeminiConfigured(),
      findings: [],
    },
    { status: 501 },
  );
}
