import { describe, expect, it } from "vitest";
import { parseHash, relatedRequirements } from "@/lib/links";
import type { RequirementResult, ValidationReport } from "@/lib/regulatory/types";

const req = (id: string, over: Partial<RequirementResult>): RequirementResult =>
  ({
    requirementId: id,
    title: id,
    status: "needs_human_review",
    evidence: [],
    deterministic: [],
    ...over,
  }) as RequirementResult;

const report = (results: RequirementResult[]) => ({ results }) as ValidationReport;

describe("relatedRequirements", () => {
  const finding = {
    title: "Model number differs across documents",
    citations: [
      { filename: "a.pdf", quote: "Model number: AP-200A", value: "AP-200A" },
      { filename: "b.pdf", quote: "Model: AP-2000A", value: "AP-2000A" },
    ],
  };

  it("links requirements whose exact comparison failed for the same field, or that share a quotation", () => {
    const v = report([
      req("2.1", { status: "conflict_detected", deterministic: [{ check: "Model number consistent across documents", outcome: "failed", detail: "" }] }),
      req("3.0", { evidence: [{ kind: "ai_quote", filename: "b.pdf", page: 1, text: "Model:  AP-2000A", synthetic: false }] }),
      req("6.0", { evidence: [{ kind: "ai_quote", filename: "c.pdf", page: 1, text: "Model: AP-2000A", synthetic: false }] }),
      req("2.1-passed", { deterministic: [{ check: "Device name consistent across documents", outcome: "passed", detail: "" }] }),
      req("na", { status: "not_applicable", deterministic: [{ check: "Model number consistent across documents", outcome: "failed", detail: "" }] }),
    ]);
    expect(relatedRequirements(finding, v).map((r) => r.requirementId)).toEqual(["2.1", "3.0"]);
  });

  it("returns nothing without a validation report", () => {
    expect(relatedRequirements(finding, null)).toEqual([]);
  });
});

describe("parseHash", () => {
  it("splits the step and its parameters", () => {
    const h = parseHash("#readiness?req=MDR-4S-AppII-2.1");
    expect(h.step).toBe("readiness");
    expect(h.params.get("req")).toBe("MDR-4S-AppII-2.1");
    expect(parseHash("#findings").step).toBe("findings");
  });
});
