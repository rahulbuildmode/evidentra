/**
 * Find a quotation inside page text for highlighting. Only an exact match, or the same characters with
 * different whitespace/line breaks, counts. Similar wording is never highlighted.
 */
export function locateQuote(pageText: string, quote: string): [number, number] | null {
  const q = quote.trim();
  if (!q) return null;
  const i = pageText.indexOf(q);
  if (i >= 0) return [i, i + q.length];
  const words = q.split(/\s+/).filter(Boolean);
  if (words.length === 0) return null;
  const re = new RegExp(words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("\\s+"));
  const m = re.exec(pageText);
  return m ? [m.index, m.index + m[0].length] : null;
}
