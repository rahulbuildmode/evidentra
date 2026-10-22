"use client";

import gsap from "gsap";
import { useEffect, useRef } from "react";

/** A gold reticle that trails the pointer, swells over links and pulls [data-magnetic] elements toward it. Fine pointers only. */
export function Cursor() {
  const ring = useRef<HTMLDivElement>(null);
  const dot = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!window.matchMedia("(pointer: fine)").matches || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const r = ring.current!;
    const d = dot.current!;
    document.documentElement.classList.add("has-cursor");
    const rx = gsap.quickTo(r, "x", { duration: 0.45, ease: "power3" });
    const ry = gsap.quickTo(r, "y", { duration: 0.45, ease: "power3" });
    const dx = gsap.quickTo(d, "x", { duration: 0.08 });
    const dy = gsap.quickTo(d, "y", { duration: 0.08 });

    let magnet: HTMLElement | null = null;
    const onMove = (e: PointerEvent) => {
      rx(e.clientX);
      ry(e.clientY);
      dx(e.clientX);
      dy(e.clientY);
      gsap.to([r, d], { opacity: 1, duration: 0.2 });
      const target = (e.target as HTMLElement | null)?.closest<HTMLElement>("a, button, [data-magnetic]");
      r.dataset.hover = target ? "1" : "";
      const m = (e.target as HTMLElement | null)?.closest<HTMLElement>("[data-magnetic]") ?? null;
      if (magnet && magnet !== m) gsap.to(magnet, { x: 0, y: 0, duration: 0.6, ease: "elastic.out(1, 0.4)" });
      magnet = m;
      if (m) {
        const b = m.getBoundingClientRect();
        gsap.to(m, { x: (e.clientX - (b.left + b.width / 2)) * 0.3, y: (e.clientY - (b.top + b.height / 2)) * 0.35, duration: 0.4, ease: "power3" });
      }
    };
    const onLeave = () => gsap.to([r, d], { opacity: 0, duration: 0.2 });
    const onDown = () => gsap.to(r, { scale: 0.75, duration: 0.15 });
    const onUp = () => gsap.to(r, { scale: 1, duration: 0.4, ease: "elastic.out(1, 0.4)" });
    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerleave", onLeave);
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("pointerup", onUp);
    return () => {
      document.documentElement.classList.remove("has-cursor");
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
    };
  }, []);

  return (
    <>
      <div ref={ring} aria-hidden className="cursor-ring" />
      <div ref={dot} aria-hidden className="cursor-dot" />
    </>
  );
}
