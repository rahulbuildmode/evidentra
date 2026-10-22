import { describe, expect, it } from "vitest";
import type { AnalysisResult, ModelOutput } from "@/lib/analysis";
import type { MappingResult } from "@/lib/mapping";
import { MFG_LICENCE_BCD } from "@/lib/regulatory/library";
import { EMPTY_PROFILE, type DeviceProfile, type Pathway } from "@/lib/regulatory/types";
import { decidePathway, validateDossier, type ValidationInput } from "@/lib/regulatory/validate";
import type { UploadedDocument } from "@/lib/uploads";
import { toItems } from "@/lib/server/gemini-analyze";
import { checkCitation } from "@/lib/server/verify-quotes";

/** Validation engine tests on small, fictional page texts. */

const DMF = "dmf.pdf";
const IFU = "ifu.pdf";
const CERT = "cert.pdf";
const pages: Record<string, string[]> = {
  [DMF]: ["Device Master File\nModel number: X-100\nIntended use: measuring things", "Risk analysis summary\nHazard: overheating; control: thermal cut-off"],
  [IFU]: ["Instructions for use\nModel: X-1000"],
  [CERT]: ["ISO 13485 certificate\nValid until: 30 June 2020"],
};

const asDocs = (synthetic: boolean): UploadedDocument[] =>
  Object.entries(pages).map(([filename, ps], i) => ({
    id: `d${i}`,
    workspaceId: "ws-t",
    filename,
    sizeBytes: 1,
    uploadedAt: "2026-01-01T00:00:00Z",
    status: "extracted",
    pageCount: ps.length,
    charCount: 100,
    emptyPages: [],
    error: null,
    origin: synthetic ? "demo" : "user",
    pages: ps.map((text, k) => ({ page: k + 1, text })),
  }));

const PROPOSAL: ModelOutput = {
  facts: [
    { category: "model_number", label: "Model number", value: "X-100", normalized_date: null, citation: { filename: DMF, page: 1, quote: "Model number: X-100" }, confidence: "high" },
    { category: "model_number", label: "Model", value: "X-1000", normalized_date: null, citation: { filename: IFU, page: 1, quote: "Model: X-1000" }, confidence: "high" },
    { category: "document_date", label: "Valid until", value: "30 June 2020", normalized_date: "2020-06-30", citation: { filename: CERT, page: 1, quote: "Valid until: 30 June 2020" }, confidence: "high" },
  ],
  inconsistencies: [],
  missing_information: [],
};

function analysisOf(docs: UploadedDocument[], out: ModelOutput = PROPOSAL): AnalysisResult {
  return { runId: "r1", workspaceId: "ws-t", source: "gemini", model: "m", createdAt: "2026-10-01T00:00:00Z", documents: [], skipped: [], items: toItems(out, docs, "r1"), usage: { promptTokens: null, outputTokens: null } };
}

function mappingOf(docs: UploadedDocument[], rows: { id: string; status: "found" | "missing" | "conflicting" | "partial"; quotes: { filename: string; page: number; quote: string }[] }[]): MappingResult {
  return {
    runId: "m1",
    workspaceId: "ws-t",
    requirementSetId: "cdsco-mdr2017-mfg-bcd",
    source: "gemini",
    model: "m",
    createdAt: "2026-10-02T00:00:00Z",
    documents: [],
    rows: rows.map((r) => ({ requirementId: r.id, status: r.status, proposedStatus: r.status, rationale: "r", nextAction: "n", codeNote: null, citations: r.quotes.map((q) => checkCitation(q, docs)) })),
  };
}

const PROFILE: DeviceProfile = { ...EMPTY_PROFILE, deviceName: "X", riskClass: "C", riskClassConfirmed: true, activity: "manufacture", ivd: "no", licenceType: "licence", testLicence: "no" };

function run(over: Partial<ValidationInput> & { synthetic?: boolean } = {}) {
  const docs = asDocs(over.synthetic ?? false);
  return validateDossier({
    workspaceId: "ws-t",
    pathway: MFG_LICENCE_BCD,
    profile: PROFILE,
    docs: docs.map((d) => ({ filename: d.filename, pages: d.pages, synthetic: d.origin === "demo" })),
    skipped: [],
    analysis: analysisOf(docs),
    mapping: null,
    today: "2026-10-22",
    ...over,
  });
}
const get = (r: ReturnType<typeof run>, id: string) => r.results.find((x) => x.requirementId === id)!;

describe("pathway and applicability (decided by code)", () => {
  it("in scope for a confirmed Class C domestic licence, with the rule 21 form", () => {
    const d = decidePathway(MFG_LICENCE_BCD, PROFILE);
    expect(d.status).toBe("in_scope");
    expect(d.form).toMatch(/MD-7/);
  });

  it("6. unknown classification leaves applicability unresolved and needs human review", () => {
    const r = run({ profile: { ...PROFILE, riskClass: "unknown", riskClassConfirmed: false } });
    expect(r.decision.status).toBe("unresolved");
    expect(r.decision.unknownFields).toContain("Risk class");
    for (const x of r.results) {
      expect(x.applicability.decision).toBe("unresolved");
      expect(x.status).toBe("needs_human_review");
    }
    expect(r.unresolved.some((u) => u.item.includes("Risk class"))).toBe(true);
  });

  it("an entered but unconfirmed class is applied conditionally and always requires human review", () => {
    const r = run({ profile: { ...PROFILE, riskClassConfirmed: false } });
    expect(get(r, "MDR-4S-II(ii)(a)").applicability).toMatchObject({ decision: "applicable", conditional: true });
    expect(get(r, "MDR-4S-II(ii)(a)").humanReviewRequired).toBe(true);
  });

  it("7. not applicable only with a recorded rationale (IVD clause; test licence 'if any')", () => {
    const r = run();
    expect(get(r, "MDR-4S-II(ii)(h)")).toMatchObject({ status: "not_applicable", applicability: { decision: "not_applicable" } });
    expect(get(r, "MDR-4S-II(ii)(h)").applicability.rationale).toMatch(/not an IVD/);
    expect(get(r, "MDR-4S-II(ii)(e)").status).toBe("not_applicable");
    expect(get(run({ profile: { ...PROFILE, testLicence: "unknown" } }), "MDR-4S-II(ii)(e)").applicability.decision).toBe("unresolved");
  });

  it("a checklist-only item applies to Class C/D and stays unresolved for Class B", () => {
    expect(get(run(), "CDSCO-MD7-5.0").applicability.decision).toBe("applicable");
    expect(get(run(), "CDSCO-MD7-5.0").checklist?.item).toBe("5.0");
    const b = run({ profile: { ...PROFILE, riskClass: "B" } });
    expect(get(b, "CDSCO-MD7-5.0")).toMatchObject({ status: "needs_human_review", applicability: { decision: "unresolved" }, checklist: null });
    expect(b.decision.form).toMatch(/MD-3/);
  });

  it("an interpretation question is never auto-decided", () => {
    expect(get(run(), "MDR-4S-II(ii)(g)")).toMatchObject({ status: "needs_human_review", applicability: { decision: "unresolved" } });
  });

  it("import / IVD are out of scope, never silently validated", () => {
    const r = run({ profile: { ...PROFILE, activity: "import" } });
    expect(r.decision.status).toBe("out_of_scope");
    expect(r.counts.evidence_found + r.counts.validated_against_source + r.counts.not_applicable).toBe(0);
  });
});

describe("evidence and statuses", () => {
  it("1. applicable requirement with verified AI evidence → evidence found (not 'compliant')", () => {
    const docs = asDocs(false);
    const r = run({ mapping: mappingOf(docs, [{ id: "MDR-4S-AppII-6.0", status: "found", quotes: [{ filename: DMF, page: 2, quote: "Hazard: overheating; control: thermal cut-off" }] }]) });
    const x = get(r, "MDR-4S-AppII-6.0");
    expect(x.status).toBe("evidence_found");
    expect(x.evidence.find((e) => e.kind === "ai_quote")).toMatchObject({ check: "verified", page: 2 });
    expect(x.explanation).toMatch(/Sufficiency is not assessed/);
  });

  it("2. applicable requirement with no evidence → potential gap that says what was searched", () => {
    const x = get(run(), "MDR-4S-AppII-7.2");
    expect(x.status).toBe("potential_gap");
    expect(x.searched).toMatch(/Searched 3 readable documents \(4 pages\)/);
    expect(x.explanation).toMatch(/not proof that it is missing/);
  });

  it("3. an AI quote not in the text is never used as evidence", () => {
    const docs = asDocs(false);
    const r = run({ mapping: mappingOf(docs, [{ id: "MDR-4S-II(ii)(b)", status: "found", quotes: [{ filename: DMF, page: 1, quote: "Site master file approved by CDSCO" }] }]) });
    const x = get(r, "MDR-4S-II(ii)(b)");
    expect(x.evidence[0]).toMatchObject({ kind: "ai_quote", check: "not_found", page: null });
    expect(x.status).not.toBe("evidence_found");
  });

  it("4. a quote on a different page keeps the proposed page and the actual page", () => {
    const docs = asDocs(false);
    const r = run({ mapping: mappingOf(docs, [{ id: "MDR-4S-AppII-6.0", status: "found", quotes: [{ filename: DMF, page: 1, quote: "Risk analysis summary" }] }]) });
    expect(get(r, "MDR-4S-AppII-6.0").evidence[0]).toMatchObject({ check: "verified_other_page", proposedPage: 1, page: 2 });
  });

  it("5. conflicting verified values across documents → conflict detected with both passages", () => {
    const x = get(run(), "MDR-4S-AppII-2.1");
    expect(x.status).toBe("conflict_detected");
    expect(x.deterministic.find((d) => d.check.startsWith("Model number"))?.outcome).toBe("failed");
    expect(x.evidence.filter((e) => e.kind === "deterministic").map((e) => e.value).sort()).toEqual(["X-100", "X-1000"]);
  });

  it("certificate validity is evaluated by code: expired → potential gap; in date → validated against source", () => {
    expect(get(run(), "MDR-4S-AppII-note3").status).toBe("potential_gap");
    expect(get(run({ today: "2019-01-01" }), "MDR-4S-AppII-note3").status).toBe("validated_against_source");
    // No extracted dates → not evaluable, never a gap or a pass.
    expect(get(run({ analysis: null }), "MDR-4S-AppII-note3").status).toBe("needs_human_review");
  });

  it("8. an unverified regulatory source can never produce a definitive result", () => {
    const pathway: Pathway = {
      ...MFG_LICENCE_BCD,
      requirements: MFG_LICENCE_BCD.requirements.map((r) => (r.id === "MDR-4S-AppII-note3" ? { ...r, verification: { ...r.verification, status: "unverified" as const } } : r)),
    };
    const x = get(run({ pathway, today: "2019-01-01" }), "MDR-4S-AppII-note3");
    expect(x.status).toBe("needs_human_review");
    expect(x.explanation).toMatch(/UNVERIFIED — DO NOT USE FOR A DEFINITIVE REGULATORY CONCLUSION/);
  });

  it("a mapping made for another requirement set is ignored", () => {
    const docs = asDocs(false);
    const m = mappingOf(docs, [{ id: "DEMO-01", status: "found", quotes: [{ filename: DMF, page: 1, quote: "Model number: X-100" }] }]);
    expect(run({ mapping: m }).inputs.mapping).toBeNull();
  });

  it("11. synthetic demo documents are labelled; user documents are not", () => {
    const demo = run({ synthetic: true });
    expect(demo.synthetic).toBe(true);
    expect(demo.limitations.join(" ")).toMatch(/SYNTHETIC DEMO DATA/);
    expect(get(demo, "MDR-4S-AppII-2.1").evidence.every((e) => e.synthetic)).toBe(true);
    const user = run();
    expect(user.synthetic).toBe(false);
    expect(get(user, "MDR-4S-AppII-2.1").evidence.some((e) => e.synthetic)).toBe(false);
  });

  it("the report never claims compliance", () => {
    const text = JSON.stringify(run());
    expect(text).not.toMatch(/\bis compliant\b|\bapproved by CDSCO\b|\bcertif(y|ies) compliance\b/i);
    expect(run().limitations[0]).toMatch(/not an official CDSCO decision/);
  });
});
