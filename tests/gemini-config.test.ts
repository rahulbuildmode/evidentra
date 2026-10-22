import { afterEach, describe, expect, it } from "vitest";
import { geminiFallbackModels } from "@/lib/gemini";

const saved = { ...process.env };
afterEach(() => {
  process.env = { ...saved };
});

describe("GEMINI_FALLBACK_MODELS", () => {
  it("parses a comma list in order, dropping blanks, duplicates, the primary model and unsafe names", () => {
    process.env.GEMINI_MODEL = "primary";
    process.env.GEMINI_FALLBACK_MODELS = " backup-1 , ,primary,backup-1,gemini-3.5-flash-lite,bad name,../x";
    expect(geminiFallbackModels()).toEqual(["backup-1", "gemini-3.5-flash-lite"]);
  });
  it("is empty when not set", () => {
    delete process.env.GEMINI_FALLBACK_MODELS;
    expect(geminiFallbackModels()).toEqual([]);
  });
});
