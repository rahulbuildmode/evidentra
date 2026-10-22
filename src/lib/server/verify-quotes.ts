import type { CheckedCitation } from "../analysis";
import type { UploadedDocument } from "../uploads";

/**
 * Normalise text so harmless differences (curly quotes, dashes, ligatures, line breaks,
 * hyphenation at line ends, case) don't fail a genuine quote. Wording must still match.
 */
export function normalizeForMatch(s: string): string {
  return s
    .normalize("NFKC")
    .replace(/­/g, "") // soft hyphen
    .replace(/[‘’‚‛′]/g, "'")
    .replace(/[“”„‟″]/g, '"')
    .replace(/[‐-―−]/g, "-")
    .replace(/-\s*\n\s*/g, "") // word split across lines
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

const MIN_QUOTE_CHARS = 6;

export function checkCitation(
  c: { filename: string; page: number | null; quote: string },
  docs: UploadedDocument[],
): CheckedCitation {
  const base = { filename: c.filename, claimedPage: c.page, quote: c.quote, verifiedPage: null };
  const doc =
    docs.find((d) => d.filename === c.filename) ??
    docs.find((d) => d.filename.toLowerCase() === c.filename.trim().toLowerCase());
  if (!doc) return { ...base, check: "unknown_file" };

  const q = normalizeForMatch(c.quote);
  if (q.length < MIN_QUOTE_CHARS) return { ...base, filename: doc.filename, check: "not_found" };

  const pages = doc.pages.map((p) => ({ page: p.page, text: normalizeForMatch(p.text) }));
  const claimed = pages.find((p) => p.page === c.page);
  if (claimed && claimed.text.includes(q)) {
    return { ...base, filename: doc.filename, verifiedPage: claimed.page, check: "verified" };
  }
  const elsewhere = pages.find((p) => p.text.includes(q));
  if (elsewhere) {
    return { ...base, filename: doc.filename, verifiedPage: elsewhere.page, check: "verified_other_page" };
  }
  return { ...base, filename: doc.filename, check: "not_found" };
}
