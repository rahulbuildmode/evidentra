"use client";

import { useState } from "react";
import { refreshShared } from "@/lib/shared-fetch";
import { actions } from "@/lib/store";
import { Molecule } from "./Molecule";

/** Opening: the signal. Decorative network and scan beam; the headline and action stay readable. */
export function Signal({ isDemo }: { isDemo: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadSample() {
    setBusy(true);
    setError(null);
    try {
      actions.resetDemo();
      const res = await fetch("/api/demo/load", { method: "POST" });
      if (!res.ok) throw new Error("The sample dossier could not be loaded.");
      await refreshShared("");
      document.getElementById("dossier")?.scrollIntoView({ behavior: "smooth" });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section id="top" className="stage print-hide relative flex min-h-[100svh] items-center overflow-hidden">
      <div className="parallax-slow absolute inset-0">
        <Molecule />
        <div aria-hidden className="glow-crimson absolute -left-40 top-1/3 h-[34rem] w-[34rem] opacity-80" />
        <div aria-hidden className="glow-ion absolute -right-32 -top-20 h-[38rem] w-[38rem]" />
        <div aria-hidden className="beam absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-ion to-transparent shadow-[0_0_24px_4px_rgba(57,231,255,0.45)]" />
      </div>
      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-b from-transparent to-obsidian" />

      <div className="relative mx-auto w-full max-w-6xl px-5 pb-16 pt-24">
        <div className="anim-fade-up font-mono text-[11px] uppercase tracking-[0.3em] text-ion" style={{ ["--d" as string]: "100ms" }}>
          Evidentra · regulatory intelligence
        </div>
        <h1 className="mt-6 text-[clamp(2.4rem,min(7vw,10vh),5.6rem)] font-black uppercase leading-[0.92] tracking-[-0.03em]">
          <span className="anim-fade-up block" style={{ ["--d" as string]: "200ms" }}>
            Complexity is
          </span>
          <span className="anim-fade-up block" style={{ ["--d" as string]: "300ms" }}>
            the <span className="text-crimson">enemy.</span>
          </span>
          <span className="anim-fade-up text-ion-grad block" style={{ ["--d" as string]: "450ms" }}>
            Evidence is
          </span>
          <span className="anim-fade-up text-ion-grad block" style={{ ["--d" as string]: "550ms" }}>
            the answer.
          </span>
        </h1>
        <p className="anim-fade-up mt-6 max-w-md text-lg text-porcelain/75" style={{ ["--d" as string]: "700ms" }}>
          Regulatory intelligence for medical-device teams.
        </p>
        <div className="anim-fade-up mt-8 flex flex-wrap items-center gap-4" style={{ ["--d" as string]: "850ms" }}>
          <a
            href="#dossier"
            className="press rounded-full bg-porcelain px-7 py-3.5 text-sm font-bold uppercase tracking-[0.14em] text-obsidian shadow-[0_0_40px_rgba(57,231,255,0.35)] hover:bg-ion focus:outline-none focus-visible:ring-2 focus-visible:ring-ion"
          >
            Analyse a dossier
          </a>
          {!isDemo && (
            <button
              type="button"
              onClick={loadSample}
              disabled={busy}
              className="press rounded-full border hairline px-5 py-3 text-xs font-medium uppercase tracking-[0.14em] text-porcelain/80 hover:border-porcelain/50 hover:text-porcelain disabled:opacity-50"
            >
              {busy ? "Loading sample…" : "Try the synthetic sample"}
            </button>
          )}
        </div>
        {error && <p className="mt-3 text-sm text-crimson">{error}</p>}
      </div>

      <a href="#dossier" aria-label="Scroll to the dossier" className="absolute bottom-6 left-1/2 -translate-x-1/2 text-porcelain/40 hover:text-porcelain">
        <span className="block font-mono text-[10px] uppercase tracking-[0.3em]">Scroll</span>
        <span aria-hidden className="mx-auto mt-2 block h-8 w-px bg-gradient-to-b from-porcelain/60 to-transparent" />
      </a>
    </section>
  );
}
