import { describe, expect, it } from "vitest";
import { checkCitation, dateAppearsInQuote, normalizeForMatch } from "@/lib/server/verify-quotes";
import type { UploadedDocument } from "@/lib/uploads";

const doc = {
  filename: "a.pdf",
  pages: [
    { page: 1, text: "Model number: AP-200A\nPower “supply”" },
    { page: 2, text: "SpO2 accuracy: ±2%" },
  ],
} as unknown as UploadedDocument;

describe("checkCitation", () => {
  it("verifies a quote on the cited page", () => {
    expect(checkCitation({ filename: "a.pdf", page: 1, quote: "Model number: AP-200A" }, [doc])).toMatchObject({ check: "verified", verifiedPage: 1 });
  });
  it("corrects the page when the quote is elsewhere in the same file", () => {
    expect(checkCitation({ filename: "a.pdf", page: 1, quote: "SpO2 accuracy: ±2%" }, [doc])).toMatchObject({ check: "verified_other_page", verifiedPage: 2 });
  });
  it("rejects fabricated quotes, unknown files and too-short quotes", () => {
    expect(checkCitation({ filename: "a.pdf", page: 1, quote: "Model number: AP-300B" }, [doc]).check).toBe("not_found");
    expect(checkCitation({ filename: "b.pdf", page: 1, quote: "Model number: AP-200A" }, [doc]).check).toBe("unknown_file");
    expect(checkCitation({ filename: "a.pdf", page: 1, quote: "AP" }, [doc]).check).toBe("not_found");
  });
  it("tolerates curly quotes and line breaks but not different words", () => {
    expect(checkCitation({ filename: "a.pdf", page: 1, quote: 'power "supply"' }, [doc]).check).toBe("verified");
    expect(normalizeForMatch("A\n  B")).toBe("a b");
  });
});

describe("dateAppearsInQuote", () => {
  it("accepts dates that appear in the quote and rejects others", () => {
    expect(dateAppearsInQuote("2027-06-30", "Valid until: 30 June 2027")).toBe(true);
    expect(dateAppearsInQuote("2027-06-30", "Valid until: 2027-06-30")).toBe(true);
    expect(dateAppearsInQuote("2027-06-30", "Valid until: 30 July 2027")).toBe(false);
    expect(dateAppearsInQuote("2028-06-30", "Valid until: 30 June 2027")).toBe(false);
  });
});
