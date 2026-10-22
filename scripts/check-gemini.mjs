// Checks that GEMINI_API_KEY in .env.local can see the configured model. Prints no secrets.
// Run: npm run check:gemini
import { GoogleGenAI } from "@google/genai";

const model = process.env.GEMINI_MODEL || "gemini-3.8-flash";
if (!process.env.GEMINI_API_KEY) {
  console.error("GEMINI_API_KEY is not set in .env.local");
  process.exit(1);
}
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
try {
  const m = await ai.models.get({ model });
  console.log(`OK: ${m.name} is available (input token limit ${m.inputTokenLimit}, output ${m.outputTokenLimit}).`);
} catch (e) {
  console.error(`FAILED for ${model}: HTTP ${e.status ?? "?"} ${String(e.message).slice(0, 300)}`);
  process.exit(1);
}
