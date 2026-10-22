"use client";

import { useEffect, useState } from "react";

const LINKS = [
  { id: "dossier", label: "Dossier" },
  { id: "anomalies", label: "Anomalies" },
  { id: "report", label: "Report" },
];

/** Three destinations only. Highlights the chapter currently in view. */
export function TopNav({ isDemo, onLight }: { isDemo: boolean; onLight?: boolean }) {
  const [active, setActive] = useState<string | null>(null);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const els = LINKS.map((l) => document.getElementById(l.id)).filter(Boolean) as HTMLElement[];
    const io = new IntersectionObserver(
      (entries) => {
        const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (vis) setActive(vis.target.id);
      },
      { rootMargin: "-40% 0px -50% 0px", threshold: [0, 0.2, 0.5] },
    );
    els.forEach((el) => io.observe(el));
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      io.disconnect();
      window.removeEventListener("scroll", onScroll);
    };
  }, []);
  const light = onLight && active === "report";
  return (
    <header
      className={`print-hide fixed inset-x-0 top-0 z-40 transition-[background-color,border-color,color] duration-300 ${
        scrolled ? (light ? "border-b border-black/10 bg-porcelain/85 text-obsidian backdrop-blur" : "border-b hairline bg-obsidian/70 text-porcelain backdrop-blur") : "border-b border-transparent text-porcelain"
      }`}
    >
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-5">
        <a href="#top" className="flex items-center gap-2 font-semibold tracking-tight focus:outline-none focus-visible:ring-2 focus-visible:ring-ion">
          <span aria-hidden className="inline-block h-2.5 w-2.5 rotate-45 bg-gradient-to-br from-ion to-crimson" />
          Evidentra
        </a>
        <nav aria-label="Main" className="flex items-center gap-1 text-sm">
          {LINKS.map((l) => (
            <a
              key={l.id}
              href={`#${l.id}`}
              aria-current={active === l.id ? "true" : undefined}
              className={`press relative rounded-full px-3 py-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-ion ${active === l.id ? (light ? "bg-obsidian text-porcelain" : "bg-porcelain/10") : "opacity-70 hover:opacity-100"}`}
            >
              {l.label}
            </a>
          ))}
        </nav>
        <span className="hidden text-[10px] font-mono uppercase tracking-[0.2em] sm:block">
          {isDemo ? (
            <span className={`rounded-full px-2 py-1 ${light ? "bg-obsidian text-lime" : "border border-lime/60 text-lime"}`}>Synthetic demo data</span>
          ) : (
            <span className="opacity-50">Your dossier</span>
          )}
        </span>
      </div>
    </header>
  );
}
