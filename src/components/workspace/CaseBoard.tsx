"use client";

import { useState } from "react";
import { relatedRequirements } from "@/lib/links";
import type { ValidationReport } from "@/lib/regulatory/types";
import type { ReportFinding } from "@/lib/report";
import { useShared } from "@/lib/shared-fetch";
import type { UploadedDocument, UploadedDocumentMeta } from "@/lib/uploads";
import { FindingDetail, LANES } from "./LeadDetail";

/**
 * The evidence board. Documents are the pinned cards; every string is a real lead connecting the
 * documents its quotations come from (coral = conflict verified by code, violet = AI / demo-seed
 * lead). Nothing on the board is decorative data.
 */

type Kind = "code" | "ai" | "gaps";
const kindOf = (f: ReportFinding): Kind => (f.group === "missing_info" ? "gaps" : f.provenance === "code" ? "code" : "ai");
const STRING = { code: "#ff5a4e", ai: "#2ee59d", gaps: "#ff8c42" } as const;

/** Card centres in board percentages: an even ring, so strings stay readable for 1–10 documents. */
function layout(n: number, focused: boolean): { x: number; y: number; r: number }[] {
  // With a lead open, the ring moves left so the lead file can dock on the right without covering cards.
  const cx = focused ? 24 : 50;
  const rx = focused ? 15 : 33;
  if (n === 1) return [{ x: cx, y: 48, r: -1.5 }];
  return Array.from({ length: n }, (_, i) => {
    const a = -Math.PI / 2 + (i / n) * Math.PI * 2;
    return { x: cx + Math.cos(a) * rx, y: 50 + Math.sin(a) * 31, r: ((i * 37) % 7) - 3 };
  });
}

/** First lines of the real page-1 text, for the card preview. */
function Preview({ workspaceId, doc }: { workspaceId: string; doc: UploadedDocumentMeta }) {
  const e = useShared(`doc:${workspaceId}:${doc.id}`, async () => {
    const res = await fetch(`/api/documents/${doc.id}?workspaceId=${encodeURIComponent(workspaceId)}`);
    if (!res.ok) throw new Error("unavailable");
    return (await res.json()).document as UploadedDocument;
  });
  const text = e.data?.pages[0]?.text ?? "";
  if (doc.status !== "extracted") return <p className="text-[9px] italic text-black/45">No extractable text — OCR may be required</p>;
  return <p className="line-clamp-4 whitespace-pre-line font-mono text-[8.5px] leading-snug text-black/60">{text.slice(0, 220) || "…"}</p>;
}

export function CaseBoard({
  workspaceId,
  docs,
  leads,
  isSeed,
  validation,
  reviews,
  selKey,
  onSelect,
  onOpenRequirement,
}: {
  workspaceId: string;
  docs: UploadedDocumentMeta[];
  leads: ReportFinding[];
  isSeed: boolean;
  validation: ValidationReport | null;
  reviews: Record<string, { reviewed?: boolean } | undefined>;
  selKey: string | null;
  onSelect: (key: string | null) => void;
  onOpenRequirement: (id: string) => void;
}) {
  const [show, setShow] = useState<Record<Kind, boolean>>({ code: true, ai: true, gaps: true });
  const sel = leads.find((f) => f.key === selKey) ?? null;
  const pos = layout(docs.length, Boolean(sel));
  const idx = new Map(docs.map((d, i) => [d.filename, i]));
  const visible = leads.filter((f) => show[kindOf(f)]);
  const filesOf = (f: ReportFinding) => [...new Set(f.citations.map((c) => c.filename))].filter((n) => idx.has(n));
  const selFiles = new Set(sel ? filesOf(sel) : []);
  const leadCount = (filename: string) => visible.filter((f) => filesOf(f).includes(filename)).length;

  // One string per pair of documents a lead connects.
  const strings = visible.flatMap((f) => {
    const files = filesOf(f);
    const pairs: [number, number][] = [];
    for (let i = 0; i < files.length - 1; i++) pairs.push([idx.get(files[i])!, idx.get(files[i + 1])!]);
    return pairs.map(([a, b], n) => ({ key: `${f.key}-${n}`, lead: f, a: pos[a], b: pos[b] }));
  });

  return (
    <div className="grid grid-cols-1 gap-3 xl:grid-cols-[15rem_1fr_17rem] [&>*]:min-w-0">
      {/* Case file column */}
      <aside className="surface-2 order-2 rounded-2xl p-3 xl:order-1" aria-label="Evidence documents">
        <h2 className="font-mono text-[10px] uppercase tracking-[0.2em] text-porcelain/55">Evidence</h2>
        <ul className="mt-2 space-y-1.5">
          {docs.map((d) => {
            const n = leadCount(d.filename);
            return (
              <li key={d.id} className={`rounded-lg border px-2.5 py-2 ${selFiles.has(d.filename) ? "border-ion/50 bg-ion/[0.06]" : "border-porcelain/10"}`}>
                <div className="truncate text-xs font-medium" title={d.filename}>
                  {d.filename.replace(/\.pdf$/i, "")}
                </div>
                <div className="mt-0.5 flex items-center justify-between font-mono text-[9px] uppercase tracking-[0.12em]">
                  <span className={d.status === "extracted" ? "text-ion" : "text-amber"}>{d.status === "extracted" ? `Text secured · ${d.pageCount} p.` : "No text"}</span>
                  {n > 0 && <span className="text-coral">{n} lead{n === 1 ? "" : "s"}</span>}
                </div>
              </li>
            );
          })}
        </ul>
        {isSeed && <p className="mt-3 rounded-md border border-dashed border-porcelain/30 px-2 py-1 text-center font-mono text-[9px] uppercase tracking-[0.16em] text-porcelain/60">Synthetic demo data</p>}
      </aside>

      {/* Evidence board */}
      <section className="order-1 xl:order-2" aria-labelledby="board-title">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <h2 id="board-title" className="font-mono text-[11px] uppercase tracking-[0.24em] text-porcelain">
            Evidence board
          </h2>
          {(
            [
              ["code", "Verified conflicts"],
              ["ai", isSeed ? "Demo-seed leads" : "AI leads"],
              ["gaps", "Possible gaps"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              aria-pressed={show[k]}
              onClick={() => setShow((s) => ({ ...s, [k]: !s[k] }))}
              className={`press rounded-md border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] focus:outline-none focus-visible:ring-2 focus-visible:ring-ion ${
                show[k] ? "border-porcelain/30 text-porcelain" : "border-porcelain/10 text-porcelain/35 line-through"
              }`}
            >
              <span aria-hidden className="mr-1 inline-block h-1.5 w-1.5 rounded-full align-middle" style={{ background: STRING[k] }} />
              {label}
            </button>
          ))}
          {sel && (
            <button type="button" onClick={() => onSelect(null)} className="press ml-auto rounded-md border border-porcelain/20 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-porcelain/70">
              Clear focus
            </button>
          )}
        </div>

        <div className="board relative overflow-hidden rounded-2xl border border-porcelain/10 md:h-[min(64vh,560px)]">
          {/* Strings (desktop) */}
          <svg className="pointer-events-none absolute inset-0 hidden h-full w-full md:block" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
            {strings.map((s) => {
              const k = kindOf(s.lead);
              const active = !sel || sel.key === s.lead.key;
              const mx = (s.a.x + s.b.x) / 2;
              const my = (s.a.y + s.b.y) / 2 + 6;
              return (
                <path
                  key={s.key}
                  d={`M ${s.a.x} ${s.a.y - 9} Q ${mx} ${my} ${s.b.x} ${s.b.y - 9}`}
                  fill="none"
                  stroke={STRING[k]}
                  strokeWidth={sel?.key === s.lead.key ? 2.4 : 1.4}
                  strokeDasharray={k === "code" ? undefined : "5 4"}
                  vectorEffect="non-scaling-stroke"
                  opacity={active ? 0.95 : 0.12}
                  className="transition-opacity duration-300"
                />
              );
            })}
          </svg>

          {/* Document cards */}
          <ul className="grid grid-cols-2 gap-3 p-3 sm:grid-cols-3 md:block md:p-0" aria-label="Documents on the board">
            {docs.map((d, i) => {
              const p = pos[i];
              const dim = sel && !selFiles.has(d.filename);
              return (
                <li
                  key={d.id}
                  className={`board-card md:absolute md:w-[9.5rem] md:-translate-x-1/2 md:-translate-y-1/2 ${dim ? "opacity-35" : ""}`}
                  style={{ left: `${p.x}%`, top: `${p.y}%`, rotate: `${p.r}deg` }}
                >
                  <div className={`paper relative p-2 ${selFiles.has(d.filename) ? "ring-2 ring-ion" : ""}`}>
                    <span aria-hidden className="absolute -top-1.5 left-1/2 h-3 w-3 -translate-x-1/2 rounded-full border-2 border-white bg-coral shadow" />
                    <div className="flex items-center justify-between font-mono text-[8px] uppercase tracking-[0.12em] text-black/45">
                      <span>{d.origin === "demo" ? "Synthetic" : "Exhibit"} {String(i + 1).padStart(2, "0")}</span>
                      <span>{d.pageCount ?? "?"} p.</span>
                    </div>
                    <div className="mt-1 h-[3.6rem] overflow-hidden rounded-sm bg-black/[0.04] p-1.5">
                      <Preview workspaceId={workspaceId} doc={d} />
                    </div>
                    <div className="mt-1.5 truncate text-[10px] font-semibold text-black/80" title={d.filename}>
                      {d.filename.replace(/\.pdf$/i, "").replace(/^\d+_/, "").replace(/_/g, " ")}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>

          {docs.length === 0 && <p className="absolute inset-0 flex items-center justify-center text-sm text-porcelain/45">No documents on the board yet.</p>}

          {/* Selected lead: case panel over the board (desktop), below it on small screens */}
          {sel && (
            <div className="anim-fade-up z-10 m-3 overflow-auto rounded-2xl border border-porcelain/15 bg-navy-2 p-4 shadow-[0_30px_60px_-20px_rgba(0,0,0,0.8)] md:absolute md:bottom-3 md:right-3 md:top-3 md:m-0 md:w-[min(30rem,48%)]">
              <div className="mb-2 flex items-center justify-between">
                <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ion">Lead file</span>
                <button type="button" onClick={() => onSelect(null)} aria-label="Close lead" className="press rounded-full px-2 text-porcelain/50 hover:text-porcelain">
                  ✕
                </button>
              </div>
              <FindingDetail
                f={sel}
                isSeed={isSeed}
                workspaceId={workspaceId}
                reviewed={Boolean(reviews[sel.key]?.reviewed)}
                onPin={() => onSelect(sel.key)}
                related={relatedRequirements(sel, validation)}
                onOpenRequirement={onOpenRequirement}
              />
            </div>
          )}
        </div>
      </section>

      {/* Leads column */}
      <aside className="order-3 space-y-2" aria-label="Leads">
        <h2 className="font-mono text-[10px] uppercase tracking-[0.2em] text-porcelain/55">Leads</h2>
        {LANES.map((lane) => {
          const items = leads.filter(lane.match);
          if (items.length === 0) return null;
          return (
            <section key={lane.id} aria-label={lane.title(isSeed)}>
              <h3 className={`mb-1 font-mono text-[9px] uppercase tracking-[0.16em] ${lane.tone}`}>
                {lane.title(isSeed)} · {items.length}
              </h3>
              <ul className="space-y-1.5">
                {items.map((f, n) => {
                  const active = sel?.key === f.key;
                  const c = f.citations[0];
                  return (
                    <li key={f.key} className="anim-fade-up" style={{ ["--d" as string]: `${n * 70}ms` }}>
                      <button
                        type="button"
                        onClick={() => onSelect(active ? null : f.key)}
                        aria-pressed={active}
                        className={`lift w-full rounded-xl border px-3 py-2 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-ion ${
                          active ? lane.activeCls : "border-porcelain/10 bg-navy/60 hover:border-porcelain/30"
                        }`}
                      >
                        <span className="flex items-start justify-between gap-2">
                          <span className="text-[13px] font-medium leading-snug">{f.title}</span>
                          <span className={`mt-0.5 shrink-0 font-mono text-[9px] uppercase ${f.humanReviewed ? "text-ion" : "text-amber"}`}>{f.humanReviewed ? "Closed" : "Open"}</span>
                        </span>
                        {f.values.length >= 2 && <span className="mt-0.5 block font-mono text-xs text-porcelain/75">{f.values.slice(0, 2).join("  ≠  ")}</span>}
                        {c && (
                          <span className="mt-0.5 block truncate font-mono text-[10px] text-porcelain/40">
                            {c.filename} · p.{c.page ?? "?"}
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
        {leads.length === 0 && <p className="text-xs text-porcelain/50">No leads. That does not prove the documents are consistent.</p>}
      </aside>
    </div>
  );
}
