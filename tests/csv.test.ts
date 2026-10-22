import { describe, expect, it } from "vitest";
import { csvCell, toCsv } from "@/lib/csv";

describe("csvCell", () => {
  it("quotes commas, doubles quotes and keeps newlines inside the field", () => {
    expect(csvCell("a,b")).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell("line1\r\nline2")).toBe('"line1\nline2"');
  });
  it("neutralises spreadsheet formulas, including after leading spaces", () => {
    for (const v of ["=1+2", "+x", "-5", "@SUM(A1)", "\tx", "\rx", "  =HYPERLINK()"]) {
      expect(csvCell(v).startsWith(`"'`)).toBe(true);
    }
    expect(csvCell("a=b")).toBe('"a=b"');
  });
  it("handles empty values and writes CRLF rows with a BOM", () => {
    expect(csvCell(null)).toBe('""');
    const out = toCsv(["h1", "h2"], [["x", 1]]);
    expect(out.startsWith("﻿")).toBe(true);
    expect(out).toBe('﻿"h1","h2"\r\n"x","1"\r\n');
  });
});
