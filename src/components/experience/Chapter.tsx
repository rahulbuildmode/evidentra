import type { ReactNode } from "react";
import { Reveal } from "./Reveal";

/** Shared chapter heading: number, name, statement. */
export function ChapterHead({ n, name, title, lead, light = false }: { n: string; name: string; title: ReactNode; lead?: string; light?: boolean }) {
  return (
    <Reveal className="mb-12 max-w-3xl">
      <div className={`flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.3em] ${light ? "text-obsidian/60" : "text-ion"}`}>
        <span>{n}</span>
        <span aria-hidden className={`h-px w-10 ${light ? "bg-obsidian/30" : "bg-ion/60"}`} />
        <span>{name}</span>
      </div>
      <h2 className="mt-4 text-[clamp(2rem,4.6vw,3.6rem)] font-black leading-[1] tracking-[-0.025em]">{title}</h2>
      {lead && <p className={`mt-4 max-w-xl text-base ${light ? "text-obsidian/70" : "text-porcelain/65"}`}>{lead}</p>}
    </Reveal>
  );
}
