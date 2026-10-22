"use client";

import { refreshShared } from "@/lib/shared-fetch";
import { actions } from "@/lib/store";
import { Molecule } from "./Molecule";
import { Reveal } from "./Reveal";

export function FinalCta() {
  return (
    <section className="stage print-hide relative overflow-hidden px-5 py-32 text-center">
      <div aria-hidden className="absolute inset-0 opacity-50">
        <Molecule />
      </div>
      <div aria-hidden className="glow-crimson absolute left-1/2 top-1/2 h-[30rem] w-[30rem] -translate-x-1/2 -translate-y-1/2" />
      <Reveal className="relative mx-auto max-w-3xl">
        <h2 className="text-[clamp(2rem,5vw,4rem)] font-black leading-[1.02] tracking-[-0.025em]">
          Less searching.
          <br />
          <span className="text-ion-grad">Clearer evidence.</span>
          <br />
          Better decisions.
        </h2>
        <button
          type="button"
          onClick={async () => {
            actions.startBlank();
            await refreshShared("");
            document.getElementById("dossier")?.scrollIntoView({ behavior: "smooth" });
          }}
          className="press mt-10 rounded-full bg-porcelain px-7 py-3.5 text-sm font-bold uppercase tracking-[0.14em] text-obsidian shadow-[0_0_40px_rgba(255,49,90,0.35)] hover:bg-ion focus:outline-none focus-visible:ring-2 focus-visible:ring-ion"
        >
          Analyse another dossier
        </button>
        <p className="mt-8 text-xs text-porcelain/40">
          Evidentra supports human review. It is not a regulator and does not certify compliance or approval.
        </p>
      </Reveal>
    </section>
  );
}
