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

/**
 * Optional comma-separated GEMINI_FALLBACK_MODELS, tried in order — each once — only when a model's
 * daily quota is used up. Names are restricted to a safe character set; the primary model is skipped.
 */
export function geminiFallbackModels(): string[] {
  const primary = geminiModel();
  return [...new Set((process.env.GEMINI_FALLBACK_MODELS ?? "").split(",").map((m) => m.trim()))].filter(
    (m) => /^[a-z0-9][a-z0-9.\-]{0,63}$/.test(m) && m !== primary,
  );
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
