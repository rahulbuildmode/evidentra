"use client";

import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useEffect, useRef, useState } from "react";

const STEPS = [
  { title: "Summon the dossier", text: "Drop in up to ten PDFs. Text is extracted on the server, and every page is kept so it can be cited later." },
  { title: "Read every page", text: "The AI reads the whole file set at once, looking for claims that should match and requirements that should be met." },
  { title: "Find the fracture", text: "Here, from the sample dossier: the Device Master File says AP-200A. The Instructions for Use say AP-2000A." },
  { title: "Trace it. Then decide.", text: "Every finding links to the exact quote on the exact page. Software checks the quote exists. You make the call." },
];

type Doc = { file: string; title: string; lines: (string | { mark: "a" | "b"; text: string } | number)[] };
// Real lines from fixtures/demo-dossier (fictional device); numbers are placeholder bar widths.
const DOCS: Doc[] = [
  {
    file: "01_device_master_file_summary.pdf",
    title: "Device Master File",
    lines: ["Device: AuraPulse Fingertip Pulse Oximeter", 82, { mark: "a", text: "Model number: AP-200A" }, "Risk class: Class B", 64, "SpO2 accuracy: ±2% (70% to 100%)", 74],
  },
  {
    file: "02_instructions_for_use.pdf",
    title: "Instructions for Use",
    lines: [88, 60, { mark: "b", text: "Model: AP-2000A" }, 92, "SpO2 accuracy: ±2% (70% to 100%)", 70, 54],
  },
  {
    file: "03_risk_management_summary.pdf",
    title: "Risk Management Summary",
    lines: ["Model AP-200A", "Hazard 1: Inaccurate SpO2 reading…", 86, "Hazard 3: Battery depletion…", 66],
  },
];
const PLACE = [
  { left: "0%", top: "3%", rot: -5 },
  { left: "51%", top: "15%", rot: 4 },
  { left: "21%", top: "53%", rot: -1.5 },
];

export function Ritual() {
  const section = useRef<HTMLElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const anim = useRef<gsap.Context | null>(null);
  const [thread, setThread] = useState<{ w: number; h: number; d: string; a: [number, number]; b: [number, number] } | null>(null);

  // Measure where the two marked lines sit once the cards are in their final places; the thread is drawn between them.
  useEffect(() => {
    const measure = () => {
      const s = stage.current;
      if (!s) return;
      // Measure the cards where they rest, not mid-animation.
      anim.current?.revert();
      const sr = s.getBoundingClientRect();
      const a = s.querySelector("[data-mark=a]")?.getBoundingClientRect();
      const b = s.querySelector("[data-mark=b]")?.getBoundingClientRect();
      if (!a || !b) return;
      const p1: [number, number] = [a.right - sr.left + 4, a.top + a.height / 2 - sr.top];
      const p2: [number, number] = [b.left - sr.left - 4, b.top + b.height / 2 - sr.top];
      const lift = sr.height * 0.22;
      const d = `M ${p1[0]} ${p1[1]} C ${p1[0] + lift} ${p1[1] - lift}, ${p2[0] - lift} ${p2[1] + lift * 1.2}, ${p2[0]} ${p2[1]}`;
      setThread({ w: sr.width, h: sr.height, d, a: p1, b: p2 });
    };
    document.fonts.ready.then(measure);
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  useEffect(() => {
    if (!thread || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    gsap.registerPlugin(ScrollTrigger);
    const ctx = (anim.current = gsap.context(() => {
      const cards = gsap.utils.toArray<HTMLElement>(".rcard");
      const tl = gsap.timeline({
        defaults: { ease: "none" },
        scrollTrigger: {
          trigger: section.current,
          start: "top top",
          end: "+=340%",
          pin: ".ritual-pin",
          scrub: 0.8,
          onUpdate: (st) => setActive(Math.min(3, Math.floor(st.progress * 4.0001))),
        },
      });
      // 0 → 1: the stack fans out.
      tl.from(cards, { left: "26%", top: "24%", rotation: (i) => (i - 1) * 2, scale: 0.86, stagger: 0.08, duration: 1, ease: "power2.inOut" }, 0);
      tl.from(".rcard-glow", { opacity: 0, duration: 0.6 }, 0.4);
      // 1 → 2: a beam reads every page.
      tl.fromTo(".rbeam", { yPercent: 0, opacity: 0 }, { opacity: 1, duration: 0.1 }, 1);
      tl.to(".rbeam", { top: "100%", duration: 0.9, ease: "power1.inOut" }, 1);
      tl.to(".rbar", { backgroundColor: "rgba(245,181,68,0.45)", stagger: 0.02, duration: 0.2 }, 1.05);
      tl.to(".rbeam", { opacity: 0, duration: 0.1 }, 1.9);
      // 2 → 3: the two claims light up and the thread joins them.
      tl.to(".rmark", { backgroundSize: "100% 100%", color: "#07060a", duration: 0.35 }, 2.05);
      tl.to(".rcard-c", { opacity: 0.35, filter: "blur(1px)", duration: 0.4 }, 2.05);
      tl.fromTo(".rthread", { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 0.55, ease: "power2.inOut" }, 2.3);
      tl.from(".rnode", { scale: 0, transformOrigin: "50% 50%", stagger: 0.25, duration: 0.25, ease: "back.out(3)" }, 2.3);
      tl.from(".rlabel", { opacity: 0, y: 12, duration: 0.3 }, 2.75);
      // 3 → 4: the seal lands.
      tl.from(".rseal", { scale: 2.4, opacity: 0, rotation: -40, duration: 0.45, ease: "back.out(1.6)" }, 3.1);
      tl.to({}, { duration: 0.5 });
    }, section));
    return () => ctx.revert();
  }, [thread]);

  return (
    <section ref={section} id="ritual" className="relative z-10" aria-labelledby="ritual-title">
      <div className="ritual-pin flex min-h-[100svh] items-center py-20 md:py-16">
        <div className="mx-auto grid w-full max-w-7xl items-center gap-10 px-4 md:grid-cols-[1.25fr_1fr] md:gap-16">
          <div ref={stage} className="ritual-stage relative aspect-[5/4] w-full">
            {DOCS.map((doc, i) => (
              <article
                key={doc.file}
                className={`rcard absolute w-[48cqw] ${i === 2 ? "rcard-c" : ""}`}
                style={{ left: PLACE[i].left, top: PLACE[i].top, transform: `rotate(${PLACE[i].rot}deg)`, zIndex: i === 2 ? 1 : 2 }}
              >
                <span aria-hidden className="rcard-glow" />
                <div className="rcard-file">{doc.file}</div>
                <div className="rcard-title">{doc.title}</div>
                <div className="mt-[1.6cqw] space-y-[1cqw]">
                  {doc.lines.map((l, j) =>
                    typeof l === "number" ? (
                      <div key={j} className="rbar" style={{ width: `${l}%` }} />
                    ) : typeof l === "string" ? (
                      <div key={j} className="rline">
                        {l}
                      </div>
                    ) : (
                      <div key={j} className="rline">
                        <mark data-mark={l.mark} className="rmark">
                          {l.text}
                        </mark>
                      </div>
                    ),
                  )}
                </div>
                <div className="rcard-page">p. 1</div>
              </article>
            ))}

            <div aria-hidden className="rbeam" />

            {thread && (
              <svg aria-hidden className="pointer-events-none absolute inset-0 z-10 overflow-visible" width={thread.w} height={thread.h} viewBox={`0 0 ${thread.w} ${thread.h}`}>
                <path d={thread.d} pathLength={1} className="rthread rthread-glow" />
                <path d={thread.d} pathLength={1} className="rthread" />
                <circle className="rnode" cx={thread.a[0]} cy={thread.a[1]} r="5" />
                <circle className="rnode" cx={thread.b[0]} cy={thread.b[1]} r="5" />
              </svg>
            )}

            <div className="rlabel absolute left-[30%] top-[44%] z-20 -translate-x-1/2 whitespace-nowrap">
              <span className="text-coral">✕</span> Model number differs across documents
            </div>

            <div className="rseal absolute bottom-[4%] right-[2%] z-20" aria-hidden>
              <div className="rseal-ring">
                <span className="font-display text-[2.6cqw] font-extrabold tracking-[0.18em]">FLAW FOUND</span>
                <span className="mt-[0.6cqw] font-mono text-[1.5cqw] tracking-wider">AP-200A ≠ AP-2000A</span>
                <span className="mt-[0.4cqw] font-mono text-[1.2cqw] uppercase tracking-[0.2em] opacity-70">quote verified · p.1</span>
              </div>
            </div>
          </div>

          <div>
            <p className="eyebrow hidden md:block">The ritual · 4 steps</p>
            <h2 id="ritual-title" className="sr-only md:not-sr-only md:mt-3 md:block font-display text-3xl font-semibold leading-tight sm:text-5xl">
              How a flaw <span className="text-ion-grad">gets caught.</span>
            </h2>
            <ol className="relative space-y-5 md:mt-8 border-l border-porcelain/10 pl-6">
              <span aria-hidden className="absolute -left-px top-0 w-px bg-ion transition-[height] duration-500" style={{ height: `${((active + 1) / STEPS.length) * 100}%` }} />
              {STEPS.map((s, i) => (
                <li key={s.title} className={`ritual-step ${i === active ? "is-active" : ""} ${i < active ? "is-done" : ""}`}>
                  <span className="font-mono text-[11px] tracking-[0.2em] text-ion">0{i + 1}</span>
                  <h3 className="mt-1 font-display text-lg font-semibold sm:text-xl">{s.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-porcelain/65">{s.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </section>
  );
}
