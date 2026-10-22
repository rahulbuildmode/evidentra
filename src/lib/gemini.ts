import { GoogleGenAI } from "@google/genai";

/**
 * Server-side only. Import this from API routes, never from client components.
 * The key is read from GEMINI_API_KEY (.env.local locally, Vercel env vars when deployed).
 */

/** Stable Flash model, checked against https://ai.google.dev/gemini-api/docs/models (Oct 2026). */
export const DEFAULT_GEMINI_MODEL = "gemini-3.8-flash";

export function geminiModel(): string {
  return process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL;
}

export function isGeminiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim());
}

export function getGeminiClient(timeoutMs = 90_000): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || !apiKey.trim()) {
    throw new Error("GEMINI_API_KEY is not set. Add it to .env.local and restart the dev server.");
  }
  return new GoogleGenAI({ apiKey: apiKey.trim(), httpOptions: { timeout: timeoutMs } });
}
