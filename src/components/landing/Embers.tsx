"use client";

import { useEffect, useRef } from "react";

type Ember = { x: number; y: number; vx: number; vy: number; r: number; life: number; hue: "gold" | "ember" | "jade"; phase: number };

const COLORS = { gold: "245,181,68", ember: "255,140,66", jade: "46,229,157" };

/** Rising sparks on a fixed canvas behind the page. They drift away from the pointer. */
export function Embers({ density = 1, className = "z-0" }: { density?: number; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let w = 0;
    let h = 0;
    const pointer = { x: -9999, y: -9999 };
    const embers: Ember[] = [];

    const spawn = (anywhere: boolean): Ember => {
      const roll = Math.random();
      return {
        x: Math.random() * w,
        y: anywhere ? Math.random() * h : h + 10,
        vx: (Math.random() - 0.5) * 0.3,
        vy: -(0.25 + Math.random() * 0.9),
        r: 0.6 + Math.random() * 1.8,
        life: 1,
        hue: roll < 0.12 ? "jade" : roll < 0.45 ? "ember" : "gold",
        phase: Math.random() * Math.PI * 2,
      };
    };

    const resize = () => {
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const target = Math.round(Math.min(140, (w * h) / 14000) * density);
      while (embers.length < target) embers.push(spawn(true));
      embers.length = target;
    };
    resize();

    const onMove = (e: PointerEvent) => {
      pointer.x = e.clientX;
      pointer.y = e.clientY;
    };
    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", onMove, { passive: true });

    let raf = 0;
    let t = 0;
    const draw = () => {
      t += 0.016;
      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = "lighter";
      for (let i = 0; i < embers.length; i++) {
        const p = embers[i];
        const dx = p.x - pointer.x;
        const dy = p.y - pointer.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < 14000) {
          const f = (1 - d2 / 14000) * 0.6;
          p.vx += (dx / Math.sqrt(d2 + 1)) * f;
          p.vy += (dy / Math.sqrt(d2 + 1)) * f * 0.5;
        }
        p.vx = p.vx * 0.96 + Math.sin(t + p.phase) * 0.012;
        p.vy = p.vy * 0.98 - 0.012;
        p.x += p.vx;
        p.y += p.vy;
        if (p.y < -20 || p.x < -20 || p.x > w + 20) embers[i] = spawn(false);
        const flicker = 0.55 + 0.45 * Math.sin(t * 3 + p.phase);
        const c = COLORS[p.hue];
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 6);
        g.addColorStop(0, `rgba(${c},${0.9 * flicker})`);
        g.addColorStop(0.25, `rgba(${c},${0.35 * flicker})`);
        g.addColorStop(1, `rgba(${c},0)`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * 6, 0, Math.PI * 2);
        ctx.fill();
      }
      if (!reduce) raf = requestAnimationFrame(draw);
    };
    draw();

    const onVisibility = () => {
      cancelAnimationFrame(raf);
      if (!document.hidden && !reduce) raf = requestAnimationFrame(draw);
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [density]);

  return <canvas ref={ref} aria-hidden className={`pointer-events-none fixed inset-0 ${className}`} />;
}
