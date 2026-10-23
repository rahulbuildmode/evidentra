"use client";

import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Cursor } from "./Cursor";
import { Embers } from "./Embers";
import { Ritual } from "./Ritual";
import { Sigil } from "./Sigil";

const INTRO_KEY = "evidentra:intro-seen";

const GUARDIANS = [
  {
    name: "The Oracle",
    role: "AI proposes",
    text: "Gemini reads every page and proposes findings: contradictions between documents and gaps against CDSCO requirements. Each one comes with a quote.",
  },
  {
    name: "The Warden",
    role: "Software verifies",
    text: "Before a finding reaches you, code checks that its quote really exists on the cited page. Quotes that can't be found are rejected, not shown.",
  },
  {
    name: "The Council",
    role: "Humans decide",
    text: "You accept, dismiss or annotate each finding, then export a readiness brief. Evidentra never certifies compliance. People do.",
  },
];

const COUNTERS = [
  { value: 10, suffix: "", label: "PDFs read together in one dossier" },
  { value: 3, suffix: "", label: "official CDSCO & MDR 2017 sources, SHA-256 pinned" },
  { value: 100, suffix: "%", label: "of AI quotes checked against their page" },
];

function SplitText({ text, className = "" }: { text: string; className?: string }) {
  return (
    <span className={className} aria-label={text}>
      {text.split(" ").map((word, w) => (
        <span key={w} aria-hidden className="inline-block whitespace-nowrap">
          {word.split("").map((ch, i) => (
            <span key={i} className="split-char inline-block">
              {ch}
            </span>
          ))}
          {w < text.split(" ").length - 1 && <span className="inline-block">&nbsp;</span>}
        </span>
      ))}
    </span>
  );
}

/** Black screen → the sigil draws itself → the portal opens onto the page. Runs once per browser session. */
function Intro({ onDone }: { onDone: () => void }) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let seen = false;
    try {
      seen = sessionStorage.getItem(INTRO_KEY) === "1";
    } catch {}
    if (seen || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      onDone();
      return;
    }
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        onComplete: () => {
          try {
            sessionStorage.setItem(INTRO_KEY, "1");
          } catch {}
          onDone();
        },
      });
      tl.set(".intro-sigil .sigil-stroke", { strokeDasharray: 1, strokeDashoffset: 1 })
        .set(".intro-sigil .sigil-tick, .intro-sigil .sigil-runes, .intro-sigil .sigil-core polygon", { opacity: 0 })
        .to(".intro-sigil .sigil-stroke", { strokeDashoffset: 0, duration: 1.4, stagger: 0.025, ease: "power2.inOut" })
        .to(".intro-sigil .sigil-tick", { opacity: 1, stagger: 0.004, duration: 0.2 }, 0.3)
        .to(".intro-sigil .sigil-runes, .intro-sigil .sigil-core polygon", { opacity: 1, duration: 0.5 }, 1.1)
        .from(".intro-word .split-char", { opacity: 0, y: 30, filter: "blur(12px)", stagger: 0.05, duration: 0.6, ease: "power3.out" }, 0.9)
        .from(".intro-sub", { opacity: 0, letterSpacing: "0.9em", duration: 0.8, ease: "power3.out" }, 1.4)
        .to(".intro-sigil", { scale: 7, opacity: 0, rotate: 90, duration: 1.1, ease: "power3.in" }, 2.5)
        .to(".intro-text", { opacity: 0, y: -20, filter: "blur(8px)", duration: 0.5 }, 2.5)
        .to(root.current, { clipPath: "circle(0% at 50% 50%)", duration: 0.9, ease: "power3.inOut" }, 2.9);
      // Any click or key skips straight to the end.
      const skip = () => tl.progress(1);
      window.addEventListener("pointerdown", skip, { once: true });
      window.addEventListener("keydown", skip, { once: true });
    }, root);
    return () => ctx.revert();
  }, [onDone]);

  return (
    <div ref={root} className="intro fixed inset-0 z-[100] flex items-center justify-center bg-obsidian" style={{ clipPath: "circle(150% at 50% 50%)" }}>
      <Sigil className="intro-sigil absolute h-[78vmin] w-[78vmin] text-ion" />
      <div className="intro-text relative text-center">
        <SplitText text="EVIDENTRA" className="intro-word font-display text-[11vmin] font-extrabold tracking-[0.12em] text-porcelain drop-shadow-[0_0_30px_rgba(245,181,68,0.6)]" />
        <div className="intro-sub mt-2 font-mono text-[10px] uppercase tracking-[0.5em] text-ion sm:text-xs">The archive opens</div>
      </div>
      <button type="button" className="absolute bottom-6 right-6 font-mono text-[10px] uppercase tracking-[0.3em] text-porcelain/50 hover:text-porcelain">
        Skip ›
      </button>
    </div>
  );
}

export function Landing() {
  const root = useRef<HTMLDivElement>(null);
  const [introDone, setIntroDone] = useState(false);
  const [showIntro, setShowIntro] = useState(true);

  // Smooth scroll, driven by GSAP's ticker so ScrollTrigger and Lenis agree on every frame.
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    gsap.registerPlugin(ScrollTrigger);
    const lenis = new Lenis({ lerp: 0.09, autoRaf: false });
    lenis.on("scroll", ScrollTrigger.update);
    const tick = (t: number) => lenis.raf(t * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);
    const onAnchor = (e: MouseEvent) => {
      const a = (e.target as HTMLElement).closest<HTMLAnchorElement>('a[href^="#"]');
      if (!a) return;
      e.preventDefault();
      lenis.scrollTo(a.getAttribute("href")!, { duration: 1.6 });
    };
    document.addEventListener("click", onAnchor);
    return () => {
      document.removeEventListener("click", onAnchor);
      gsap.ticker.remove(tick);
      lenis.destroy();
    };
  }, []);

  // Hero entrance, plus the sigil that leans toward the pointer.
  useEffect(() => {
    if (!introDone) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const ctx = gsap.context(() => {
      if (!reduce) {
        gsap
          .timeline()
          .from(".hero-sigil", { scale: 0.6, opacity: 0, rotate: -60, duration: 1.8, ease: "expo.out" })
          .from(".hero-eyebrow", { opacity: 0, y: 14, duration: 0.6 }, 0.2)
          .from(".hero-title .split-char", { yPercent: 110, opacity: 0, rotateX: -80, stagger: 0.025, duration: 0.9, ease: "expo.out" }, 0.25)
          .from(".hero-sub, .hero-cta > *, .hero-cue", { opacity: 0, y: 20, stagger: 0.08, duration: 0.8, ease: "power3.out" }, 0.8);

        const rx = gsap.quickTo(".hero-sigil-tilt", "rotationX", { duration: 1.2, ease: "power3" });
        const ry = gsap.quickTo(".hero-sigil-tilt", "rotationY", { duration: 1.2, ease: "power3" });
        const onMove = (e: PointerEvent) => {
          rx(((e.clientY / window.innerHeight) - 0.5) * -24);
          ry(((e.clientX / window.innerWidth) - 0.5) * 24);
        };
        window.addEventListener("pointermove", onMove, { passive: true });

        // Hero sinks and blurs as you scroll past it.
        gsap.to(".hero-inner", { yPercent: 30, opacity: 0, filter: "blur(10px)", ease: "none", scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true } });
        gsap.to(".hero-sigil", { scale: 1.5, rotate: 120, ease: "none", scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true } });

        // The marquee leans with scroll speed.
        const skew = gsap.quickTo(".marquee-track", "skewX", { duration: 0.5, ease: "power3" });
        ScrollTrigger.create({ onUpdate: (s) => skew(gsap.utils.clamp(-14, 14, s.getVelocity() / -250)) });

        // Guardians rise in, and each card's light follows the pointer.
        gsap.from(".guardian", { y: 80, opacity: 0, rotateX: 18, stagger: 0.15, duration: 1, ease: "expo.out", scrollTrigger: { trigger: ".guardians", start: "top 75%" } });

        // MISSING. EVIDENCE. FOUND. — each letter ignites as it crosses the screen.
        gsap.utils.toArray<HTMLElement>(".slam-word").forEach((word) => {
          gsap.fromTo(
            word.querySelectorAll(".split-char"),
            { opacity: 0.08, y: 60, rotate: 8 },
            { opacity: 1, y: 0, rotate: 0, stagger: 0.06, ease: "power2.out", scrollTrigger: { trigger: word, start: "top 90%", end: "top 45%", scrub: 0.6 } },
          );
        });

        gsap.from(".final-sigil", { scale: 0.3, rotate: -180, opacity: 0, ease: "none", scrollTrigger: { trigger: ".final", start: "top bottom", end: "center center", scrub: 1 } });

        return () => window.removeEventListener("pointermove", onMove);
      }
    }, root);

    // Counters tick up once, when they come into view.
    const counters = gsap.utils.toArray<HTMLElement>(".counter-value");
    const triggers = counters.map((el) =>
      ScrollTrigger.create({
        trigger: el,
        start: "top 85%",
        once: true,
        onEnter: () => {
          const target = Number(el.dataset.value);
          if (reduce) return;
          const obj = { v: 0 };
          gsap.to(obj, { v: target, duration: 1.8, ease: "power3.out", onUpdate: () => (el.textContent = String(Math.round(obj.v))) });
        },
      }),
    );
    return () => {
      triggers.forEach((t) => t.kill());
      ctx.revert();
    };
  }, [introDone]);

  const onGuardianMove = (e: React.PointerEvent<HTMLElement>) => {
    const el = e.currentTarget;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    el.style.setProperty("--mx", `${x * 100}%`);
    el.style.setProperty("--my", `${y * 100}%`);
    gsap.to(el, { rotationY: (x - 0.5) * 14, rotationX: (0.5 - y) * 14, duration: 0.5, ease: "power3" });
  };
  const onGuardianLeave = (e: React.PointerEvent<HTMLElement>) => gsap.to(e.currentTarget, { rotationX: 0, rotationY: 0, duration: 0.8, ease: "elastic.out(1, 0.5)" });

  return (
    <div ref={root} className="landing relative overflow-x-clip bg-obsidian text-porcelain">
      {showIntro && (
        <Intro
          onDone={() => {
            setShowIntro(false);
            setIntroDone(true);
          }}
        />
      )}
      <Cursor />
      <Embers />
      <div aria-hidden className="vignette pointer-events-none fixed inset-0 z-[1]" />

      <header className="fixed inset-x-0 top-0 z-50">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2.5 font-display text-sm font-semibold tracking-[0.25em]">
            <span aria-hidden className="inline-block h-2.5 w-2.5 rotate-45 bg-ion shadow-[0_0_14px_rgba(245,181,68,0.9)]" />
            EVIDENTRA
          </Link>
          <nav className="flex items-center gap-1 text-sm">
            <a href="#ritual" className="hidden rounded-full px-3 py-1.5 text-porcelain/60 hover:text-porcelain sm:inline">
              The ritual
            </a>
            <a href="#guardians" className="hidden rounded-full px-3 py-1.5 text-porcelain/60 hover:text-porcelain sm:inline">
              How it works
            </a>
            <Link href="/app" data-magnetic className="btn-ghost ml-2 rounded-full px-4 py-1.5">
              Open app
            </Link>
          </nav>
        </div>
      </header>

      <main className="relative z-10">
        {/* Hero */}
        <section className="hero relative flex min-h-[100svh] items-center justify-center overflow-hidden px-4 pt-16">
          <div aria-hidden className="absolute inset-0 flex items-center justify-center [perspective:1200px]">
            <div className="hero-sigil-tilt [transform-style:preserve-3d]">
              <Sigil className="hero-sigil h-[118vmin] w-[118vmin] text-ion opacity-[0.28]" />
            </div>
          </div>
          <div aria-hidden className="glow-core absolute left-1/2 top-1/2 h-[60vmin] w-[60vmin] -translate-x-1/2 -translate-y-1/2 rounded-full" />
          <div className="hero-inner relative max-w-5xl text-center">
            <p className="hero-eyebrow eyebrow">Regulatory intelligence · CDSCO · MDR 2017</p>
            <h1 className="hero-title mt-5 font-display text-[13vw] font-extrabold leading-[0.95] tracking-tight [perspective:600px] sm:text-[9vw] lg:text-[7.4rem]">
              <SplitText text="Every dossier" className="block" />
              <SplitText text="hides a flaw." className="text-ion-grad block pb-2" />
            </h1>
            <p className="hero-sub mx-auto mt-6 max-w-2xl text-base leading-relaxed text-porcelain/70 sm:text-lg">
              Evidentra reads your medical-device dossier, traces every claim to the page it came from, and shows what CDSCO will ask for before they do.
            </p>
            <div className="hero-cta mt-9 flex flex-wrap items-center justify-center gap-3">
              <Link href="/app" data-magnetic className="btn-gold rounded-full px-7 py-3.5 text-sm font-semibold tracking-wide">
                Open the archive →
              </Link>
              <a href="#ritual" data-magnetic className="btn-ghost rounded-full px-7 py-3.5 text-sm">
                Watch the ritual
              </a>
            </div>
          </div>
          <a href="#ritual" className="hero-cue absolute bottom-7 left-1/2 flex -translate-x-1/2 flex-col items-center gap-2 font-mono text-[10px] uppercase tracking-[0.35em] text-porcelain/45">
            Scroll
            <span aria-hidden className="scroll-line" />
          </a>
        </section>

        {/* Marquee */}
        <div aria-hidden className="marquee relative border-y border-ion/15 py-5">
          <div className="marquee-track">
            {[0, 1].map((k) => (
              <div key={k} className="marquee-run">
                {["Trace", "Verify", "Decide", "Cite the page", "Catch the flaw", "Before CDSCO does"].map((w) => (
                  <span key={w} className="flex items-center gap-8 pr-8">
                    <span className="font-display text-4xl font-semibold uppercase tracking-[0.08em] sm:text-6xl">{w}</span>
                    <span className="text-2xl text-ion">✦</span>
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>

        <Ritual />

        {/* Guardians */}
        <section id="guardians" className="guardians relative px-4 py-28 sm:py-36">
          <div className="mx-auto max-w-7xl">
            <p className="eyebrow text-center">Three guardians · one rule</p>
            <h2 className="mx-auto mt-3 max-w-3xl text-center font-display text-3xl font-semibold leading-tight sm:text-5xl">
              No finding reaches you <span className="text-ion-grad">without proof.</span>
            </h2>
            <div className="mt-16 grid gap-6 [perspective:1400px] md:grid-cols-3">
              {GUARDIANS.map((g, i) => (
                <article key={g.name} className="guardian" onPointerMove={onGuardianMove} onPointerLeave={onGuardianLeave}>
                  <div className="relative mx-auto h-32 w-32">
                    <Sigil className={`guardian-sigil h-full w-full ${i === 1 ? "text-ultra" : "text-ion"}`} runes={`${g.role.toUpperCase()} ✦ `} />
                    <span className="absolute inset-0 flex items-center justify-center font-display text-2xl font-extrabold text-porcelain">{["I", "II", "III"][i]}</span>
                  </div>
                  <p className="mt-6 font-mono text-[11px] uppercase tracking-[0.25em] text-ion">{g.role}</p>
                  <h3 className="mt-2 font-display text-2xl font-semibold">{g.name}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-porcelain/65">{g.text}</p>
                  {i < 2 && <span aria-hidden className="guardian-arrow">→</span>}
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Slam */}
        <section aria-label="Missing evidence, found" className="relative px-4 py-16 text-center">
          {["MISSING.", "EVIDENCE.", "FOUND."].map((w, i) => (
            <div key={w} className={`slam-word font-display text-[17vw] font-extrabold leading-[0.9] tracking-tight sm:text-[14vw] ${i === 2 ? "text-ion-grad" : ""}`}>
              <SplitText text={w} />
            </div>
          ))}
        </section>

        {/* Counters */}
        <section className="relative px-4 py-24">
          <div className="mx-auto grid max-w-6xl gap-px overflow-hidden rounded-3xl border border-ion/15 bg-ion/15 sm:grid-cols-3">
            {COUNTERS.map((c) => (
              <div key={c.label} className="bg-obsidian/90 p-10 text-center backdrop-blur">
                <div className="font-display text-6xl font-extrabold text-ion sm:text-7xl">
                  <span className="counter-value" data-value={c.value}>
                    {c.value}
                  </span>
                  {c.suffix}
                </div>
                <p className="mx-auto mt-3 max-w-[16rem] text-sm text-porcelain/60">{c.label}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Final portal */}
        <section className="final relative flex min-h-[100svh] items-center justify-center overflow-hidden px-4">
          <Sigil className="final-sigil absolute h-[92vmin] w-[92vmin] text-ion opacity-60" />
          <div aria-hidden className="glow-core absolute left-1/2 top-1/2 h-[50vmin] w-[50vmin] -translate-x-1/2 -translate-y-1/2 rounded-full" />
          <div className="relative text-center">
            <p className="eyebrow">Try it on the sample dossier</p>
            <h2 className="mt-4 font-display text-5xl font-extrabold leading-none sm:text-8xl">
              The archive
              <br />
              <span className="text-ion-grad">is open.</span>
            </h2>
            <Link href="/app" data-magnetic className="btn-gold mt-10 inline-block rounded-full px-9 py-4 text-base font-semibold tracking-wide">
              Enter Evidentra →
            </Link>
          </div>
        </section>
      </main>

      <footer className="relative z-10 border-t border-porcelain/10 px-4 py-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 text-xs text-porcelain/45 sm:flex-row sm:justify-between">
          <span className="font-display tracking-[0.25em]">EVIDENTRA</span>
          <span>Not legal advice. Does not certify compliance. The sample dossier is fictional.</span>
        </div>
      </footer>
    </div>
  );
}
