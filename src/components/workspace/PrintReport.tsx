"use client";

import { VALIDATION_LABEL } from "@/lib/regulatory/types";
import { useGapReport } from "@/lib/use-report";
import { useValidation } from "@/lib/use-validation";

const fmt = (iso: string) => new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

/**
 * The readiness report as a light, printable document (shown only when printing). Built from the
 * same server validation report and findings as the screen; nothing is added.
 */
export function PrintReport() {
  const { state, report } = useGapReport();
  const { report: v } = useValidation(state.workspaceId);
  if (!v) return null;
  const issues = report.findings.filter((f) => f.group === "discrepancy" && !f.dismissed);
  return (
    <article className="hidden bg-white p-8 text-[11pt] leading-snug text-[#121826] print:block">
      <header className="border-b border-black/15 pb-3">
        <p className="text-[9pt] uppercase tracking-widest text-black/50">Evidentra · CDSCO readiness report{v.synthetic ? " · SYNTHETIC DEMO DATA" : ""}</p>
        <h1 className="mt-1 text-[18pt] font-semibold">{v.profile.deviceName || "Untitled dossier"}</h1>
        <p className="text-[9.5pt] text-black/65">
          {v.decision.status === "in_scope" ? v.decision.form : v.decision.label} · requirements library v{v.pathway.libraryVersion} (checked {v.pathway.lastReviewed}) · prepared{" "}
          {fmt(v.generatedAt)}
        </p>
        <p className="mt-2 text-[9pt] text-black/60">
          Prototype readiness assessment — not an official CDSCO decision, legal opinion or compliance certification. AI proposes, software verifies, humans decide.
        </p>
      </header>

      <section className="mt-4">
        <h2 className="text-[12pt] font-semibold">Summary</h2>
        <p className="text-[10pt]">
          {v.inputs.documentsReviewed.length} documents checked against {v.results.length} selected requirements:{" "}
          {Object.entries(v.counts)
            .filter(([, n]) => n > 0)
            .map(([k, n]) => `${n} ${VALIDATION_LABEL[k as keyof typeof VALIDATION_LABEL].toLowerCase()}`)
            .join(", ")}
          .
        </p>
      </section>

      {issues.length > 0 && (
        <section className="mt-4">
          <h2 className="text-[12pt] font-semibold">Inconsistencies between documents</h2>
          <ul className="mt-1 space-y-1.5 text-[10pt]">
            {issues.map((f) => (
              <li key={f.key}>
                <strong>{f.title}</strong> ({f.provenance === "code" ? "verified by code" : v.synthetic ? "demo seed" : "AI proposal"}
                {f.humanReviewed ? ", reviewed" : ", needs review"}) — {f.detail}
                <span className="block text-[9pt] text-black/60">
                  {f.citations.map((c) => `“${c.quote}” — ${c.filename}, p.${c.page ?? "?"}${c.verified ? "" : " (not verified)"}`).join("; ")}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-4">
        <h2 className="text-[12pt] font-semibold">Requirement-by-requirement</h2>
        <table className="mt-1 w-full border-collapse text-[9pt]">
          <thead>
            <tr className="border-b border-black/30 text-left">
              <th className="py-1 pr-2">Requirement</th>
              <th className="py-1 pr-2">Applicability</th>
              <th className="py-1 pr-2">Result</th>
              <th className="py-1">Evidence and next action</th>
            </tr>
          </thead>
          <tbody>
            {v.results.map((r) => {
              const e = r.evidence.find((x) => x.kind === "ai_quote" && x.page !== null) ?? r.evidence[0];
              return (
                <tr key={r.requirementId} className="break-inside-avoid border-b border-black/10 align-top">
                  <td className="py-1.5 pr-2">
                    <strong>{r.title}</strong>
                    <span className="block text-black/55">
                      {r.reference}, PDF p.{r.sourcePage}
                    </span>
                  </td>
                  <td className="py-1.5 pr-2">{r.applicability.decision.replace("_", " ")}</td>
                  <td className="py-1.5 pr-2">{VALIDATION_LABEL[r.status]}</td>
                  <td className="py-1.5">
                    {e && (
                      <span className="block text-black/70">
                        “{e.text}” — {e.filename}, p.{e.page ?? "?"}
                      </span>
                    )}
                    <span className="block">Next: {r.nextAction}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <section className="mt-4 break-inside-avoid">
        <h2 className="text-[12pt] font-semibold">Unresolved</h2>
        <ul className="mt-1 list-disc pl-5 text-[9.5pt]">
          {v.unresolved.map((u) => (
            <li key={u.item}>
              {u.item} — <span className="text-black/60">{u.why}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[8.5pt] text-black/50">Source: {v.pathway.source.title} ({v.pathway.source.version}) — {v.pathway.source.url}</p>
      </section>
    </article>
  );
}
