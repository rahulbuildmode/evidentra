import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { MD7_CHECKLIST, MFG_LICENCE_BCD, PATHWAYS, PULSE_OXIMETER_CLASSIFICATION } from "@/lib/regulatory/library";
import { normalizeForMatch } from "@/lib/server/verify-quotes";

/** The stored text of the cited pages of the official CDSCO PDF (see data/regulatory). */
type Snapshot = { sha256: string; url: string; pages: Record<string, string> };
const load = (f: string) => JSON.parse(readFileSync(path.join(process.cwd(), "data/regulatory", f), "utf8")) as Snapshot;
const snapshot = load("mdr2017-cited-pages.json");
const checklist = load("cdsco-md7-checklist.json");
const classification = load("cdsco-classification-p9.json");
const SNAPSHOTS: Record<string, Snapshot> = { [snapshot.url]: snapshot, [checklist.url]: checklist };
const onPage = (snap: Snapshot, page: number, text: string) => normalizeForMatch(snap.pages[String(page)] ?? "").includes(normalizeForMatch(text));

describe("CDSCO requirements library", () => {
  it("every verified excerpt appears verbatim on its cited page of the official PDF", () => {
    for (const p of PATHWAYS) {
      for (const r of [...p.requirements, ...p.basis.map((b) => ({ id: b.reference, ...b, verification: { status: "verified" } }))]) {
        if (r.verification.status !== "verified") continue;
        const snap = SNAPSHOTS["sourceUrl" in r ? (r.sourceUrl as string) : snapshot.url];
        expect(snap, `${r.id}: no snapshot for its source`).toBeTruthy();
        expect(onPage(snap, r.sourcePage, r.excerpt), `${r.id} excerpt not on p.${r.sourcePage}`).toBe(true);
      }
    }
  });

  it("every Form MD-7 checklist cross-reference appears in the official checklist", () => {
    for (const r of MFG_LICENCE_BCD.requirements.filter((x) => x.checklist)) {
      const t = `${r.checklist!.item} ${r.checklist!.text}`;
      expect(onPage(checklist, 1, t) || onPage(checklist, 2, t), `${r.id}: checklist item ${r.checklist!.item}`).toBe(true);
    }
    expect(MD7_CHECKLIST.sha256).toBe(checklist.sha256);
  });

  it("the demo device's classification excerpt appears in the official classification list", () => {
    expect(PULSE_OXIMETER_CLASSIFICATION.url).toBe(classification.url);
    expect(onPage(classification, PULSE_OXIMETER_CLASSIFICATION.page, PULSE_OXIMETER_CLASSIFICATION.excerpt)).toBe(true);
  });

  it("points at the same official file the snapshot was taken from", () => {
    expect(MFG_LICENCE_BCD.source.url).toBe(snapshot.url);
    expect(MFG_LICENCE_BCD.source.sha256).toBe(snapshot.sha256);
    for (const r of MFG_LICENCE_BCD.requirements) expect(r.sourceUrl.startsWith("https://cdsco.gov.in/")).toBe(true);
  });

  it("has unique ids and a testable criterion for every item", () => {
    const ids = MFG_LICENCE_BCD.requirements.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const r of MFG_LICENCE_BCD.requirements) expect(r.criterionText.length).toBeGreaterThan(10);
  });
});
