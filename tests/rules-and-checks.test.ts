import { describe, expect, it } from "vitest";
import type { AnalysisResult, CheckedCitation } from "@/lib/analysis";
import { crossCheck } from "@/lib/checks";
import { DEMO_WORKSPACE } from "@/lib/demo-data";
import { applyEvidenceRules } from "@/lib/mapping";
import { isSafeId } from "@/lib/uploads";

const ok = (quote: string): CheckedCitation => ({ filename: "a.pdf", claimedPage: 1, verifiedPage: 1, quote, check: "verified" });
const bad = (quote: string): CheckedCitation => ({ filename: "a.pdf", claimedPage: 1, verifiedPage: null, quote, check: "not_found" });

describe("applyEvidenceRules", () => {
  it("never lets a status be stronger than its verified evidence", () => {
    expect(applyEvidenceRules("found", [bad("x")]).status).toBe("needs_review");
    expect(applyEvidenceRules("partial", []).status).toBe("needs_review");
    expect(applyEvidenceRules("conflicting", [ok("a")]).status).toBe("needs_review");
    expect(applyEvidenceRules("conflicting", [ok("a"), ok("b")]).status).toBe("conflicting");
    expect(applyEvidenceRules("found", [ok("a")]).status).toBe("found");
  });
  it("words missing as not found, not as proof of absence", () => {
    expect(applyEvidenceRules("missing", []).codeNote).toMatch(/not proof/);
  });
});

function fact(id: string, category: string, label: string, value: string, filename: string, verified = true, normalizedDate: string | null = null) {
  return {
    id, kind: "fact" as const, category: category as never, field: label, value, modelConfidence: "high" as const, uncertainty: "low" as const, normalizedDate,
    citations: [{ filename, claimedPage: 1, verifiedPage: verified ? 1 : null, quote: `${label}: ${value}`, check: verified ? ("verified" as const) : ("not_found" as const) }],
  };
}

describe("crossCheck", () => {
  const result = (items: ReturnType<typeof fact>[]) => ({ items } as unknown as AnalysisResult);
  it("flags model-number mismatches across documents", () => {
    const f = crossCheck(result([fact("1", "model_number", "Model", "AP-200A", "a.pdf"), fact("2", "model_number", "Model", "AP-2000A", "b.pdf")]), DEMO_WORKSPACE, "2026-10-22");
    expect(f.find((x) => x.id === "cc-model_number-mismatch")?.severity).toBe("fail");
  });
  it("ignores facts whose quotation was not verified", () => {
    const f = crossCheck(result([fact("1", "model_number", "Model", "AP-200A", "a.pdf"), fact("2", "model_number", "Model", "XYZ", "b.pdf", false)]), DEMO_WORKSPACE, "2026-10-22");
    expect(f.find((x) => x.id === "cc-model_number-mismatch")).toBeUndefined();
  });
  it("treats formatting-only differences as a note, and flags expired validity dates", () => {
    const f = crossCheck(
      result([
        fact("1", "manufacturer_name", "Manufacturer", "Fictional MedTech Pvt. Ltd.", "a.pdf"),
        fact("2", "manufacturer_name", "Manufacturer", "Fictional MedTech Pvt Ltd", "b.pdf"),
        fact("3", "document_date", "Valid until", "31 March 2025", "c.pdf", true, "2025-03-31"),
      ]),
      DEMO_WORKSPACE,
      "2026-10-22",
    );
    expect(f.find((x) => x.id === "cc-manufacturer_name-format")?.severity).toBe("info");
    expect(f.some((x) => x.check === "Validity date" && x.severity === "fail")).toBe(true);
  });
});

describe("isSafeId", () => {
  it("only allows ids that are safe as file names", () => {
    expect(isSafeId("demo-workspace")).toBe(true);
    expect(isSafeId("../../etc")).toBe(false);
    expect(isSafeId("a/b")).toBe(false);
    expect(isSafeId("")).toBe(false);
  });
});

describe("crossCheck within one document", () => {
  it("flags conflicting identifiers between pages of the same file", () => {
    const items = [fact("1", "model_number", "Model number", "NT-100", "a.pdf"), fact("2", "model_number", "Model", "NT-110", "a.pdf")];
    const f = crossCheck({ items } as unknown as AnalysisResult, DEMO_WORKSPACE, "2026-10-22");
    expect(f.find((x) => x.id === "cc-model_number-mismatch")?.title).toBe("Model number differs within a.pdf");
  });
});
