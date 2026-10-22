import { ApiError } from "@google/genai";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ModelOutputSchema } from "@/lib/analysis";
import { MappingOutputSchema } from "@/lib/mapping";
import type { AiTrace } from "@/lib/server/gemini-common";

/** generateStructured with the Gemini client replaced by a scripted fake (no network). */

const replies: (() => unknown)[] = [];
vi.mock("@/lib/gemini", () => ({
  geminiModel: () => "test-model",
  isGeminiConfigured: () => true,
  getGeminiClient: () => ({
    models: {
      generateContent: async () => {
        const next = replies.shift();
        if (!next) throw new Error("no scripted reply");
        return next();
      },
    },
  }),
}));

const ok = (text: string) => () => ({ text, candidates: [{ finishReason: "STOP" }], usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5 } });
const apiError = (status: number, message: string) => () => {
  throw new ApiError({ status, message });
};

const trace = (): AiTrace => ({ stage: "mapping", attempts: [] });

beforeEach(() => {
  replies.length = 0;
});

describe("generateStructured", () => {
  it("9. rejects malformed output twice and saves nothing (attempts recorded)", async () => {
    const { generateStructured } = await import("@/lib/server/gemini-common");
    replies.push(ok("not json"), ok(JSON.stringify({ rows: [{ requirement_id: "x" }] })));
    const t = trace();
    await expect(generateStructured(MappingOutputSchema, "sys", "p", t)).rejects.toMatchObject({ code: "malformed_output" });
    expect(t.attempts.map((a) => a.outcome)).toEqual(["unusable_output", "unusable_output"]);
    expect(t.output).toBeUndefined();
  });

  it("accepts schema-valid output on the retry and records real token counts", async () => {
    const { generateStructured } = await import("@/lib/server/gemini-common");
    replies.push(ok("{"), ok(JSON.stringify({ facts: [], inconsistencies: [], missing_information: [] })));
    const t = trace();
    const r = await generateStructured(ModelOutputSchema, "sys", "p", t);
    expect(r.usage).toEqual({ promptTokens: 10, outputTokens: 5 });
    expect(t.attempts.map((a) => a.outcome)).toEqual(["unusable_output", "ok"]);
  });

  it("10. quota (429) is not retried and is reported honestly", async () => {
    const { generateStructured } = await import("@/lib/server/gemini-common");
    replies.push(apiError(429, "You exceeded your current quota, please check your plan and billing details"));
    const t = trace();
    await expect(generateStructured(MappingOutputSchema, "sys", "p", t)).rejects.toMatchObject({ code: "quota", httpStatus: 429 });
    expect(t.attempts).toHaveLength(1);
    expect(t.attempts[0]).toMatchObject({ outcome: "error", httpStatus: 429, promptTokens: null });
  });

  it("10. a network failure becomes 'unavailable' with no fabricated output", async () => {
    const { generateStructured } = await import("@/lib/server/gemini-common");
    replies.push(() => {
      throw new TypeError("fetch failed");
    });
    const t = trace();
    await expect(generateStructured(MappingOutputSchema, "sys", "p", t)).rejects.toMatchObject({ code: "unavailable" });
    expect(t.output).toBeUndefined();
  });
});

describe("429 handling", () => {
  const minute = `{"error":{"code":429,"message":"You exceeded your current quota. Quota exceeded for metric: generate_content_free_tier_requests, limit: 5, model: m\\nPlease retry in 1.2s.","details":[{"quotaId":"GenerateRequestsPerMinutePerProjectPerModel-FreeTier"}]}}`;
  const day = `{"error":{"code":429,"message":"You exceeded your current quota. limit: 20, model: m\\nPlease retry in 19h26m0.5s.","details":[{"quotaId":"GenerateRequestsPerDayPerProjectPerModel-FreeTier"}]}}`;

  it("reads Google's quota window, limit and wait", async () => {
    const { quotaInfo } = await import("@/lib/server/gemini-common");
    expect(quotaInfo(minute)).toMatchObject({ window: "minute", limit: 5, freeTier: true });
    expect(quotaInfo(day)).toMatchObject({ window: "day", limit: 20 });
    expect(Math.round(quotaInfo(day).retryAfterS!)).toBe(19 * 3600 + 26 * 60 + 1);
  });

  it("retries a short per-minute limit once, then succeeds (both attempts recorded)", async () => {
    const { generateStructured } = await import("@/lib/server/gemini-common");
    replies.push(apiError(429, minute), ok(JSON.stringify({ rows: [] })));
    const t = trace();
    await generateStructured(MappingOutputSchema, "sys", "p", t);
    expect(t.attempts.map((a) => [a.httpStatus, a.outcome])).toEqual([
      [429, "overloaded_retry"],
      [200, "ok"],
    ]);
  });

  it("never retries a daily quota and says which limit was hit", async () => {
    const { generateStructured } = await import("@/lib/server/gemini-common");
    replies.push(apiError(429, day));
    const t = trace();
    await expect(generateStructured(MappingOutputSchema, "sys", "p", t)).rejects.toMatchObject({ code: "quota", message: expect.stringMatching(/daily request quota.*limit 20 per day, free tier/) });
    expect(t.attempts).toHaveLength(1);
  });
});
