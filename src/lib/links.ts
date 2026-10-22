import type { RequirementResult, ValidationReport } from "./regulatory/types";

interface FindingLike {
  title: string;
  citations: { filename: string; quote: string; value?: string }[];
}

const norm = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();

/**
 * CDSCO requirement results that rest on the same evidence as a finding: a requirement whose
 * evidence includes one of the finding's quotations (same document), or whose exact comparison
 * failed for the field the finding is about. Not-applicable requirements are left out.
 */
export function relatedRequirements(f: FindingLike, v: ValidationReport | null): RequirementResult[] {
  if (!v) return [];
  const quotes = f.citations.map((c) => ({ file: c.filename, quote: norm(c.quote), value: c.value ? norm(c.value) : null }));
  const title = norm(f.title);
  return v.results.filter((r) => {
    if (r.status === "not_applicable") return false;
    const sharesEvidence = r.evidence.some((e) =>
      quotes.some((q) => q.file === e.filename && (q.quote === norm(e.text) || (q.value !== null && e.value !== undefined && q.value === norm(e.value)))),
    );
    const sameFailedCheck = r.deterministic.some((d) => d.outcome === "failed" && title.includes(norm(d.check.split(" consistent")[0])));
    return sharesEvidence || sameFailedCheck;
  });
}

/** Parse "#readiness?req=ID" style hashes. */
export function parseHash(hash: string): { step: string; params: URLSearchParams } {
  const h = hash.replace(/^#/, "");
  const i = h.indexOf("?");
  return i < 0 ? { step: h, params: new URLSearchParams() } : { step: h.slice(0, i), params: new URLSearchParams(h.slice(i + 1)) };
}
