"use client";

import { useEffect, useRef, useState } from "react";
import type { Achievement, MissionTask } from "@/lib/case-progress";
import { useCaseProgress } from "@/lib/use-case-progress";

/** Compact mission-task cards: each one is done only when the underlying action really happened. */
export function MissionTasks({ tasks, compact = false }: { tasks: MissionTask[]; compact?: boolean }) {
  return (
    <ol className={`grid gap-2 ${compact ? "grid-cols-1" : "grid-cols-2 sm:grid-cols-4 lg:grid-cols-7"}`} aria-label="Mission tasks">
      {tasks.map((t, i) => (
        <li
          key={t.id}
          className={`rounded-xl border px-3 py-2 transition-colors ${t.done ? "border-ion/35 bg-ion/[0.06]" : "border-porcelain/10 bg-navy/50"}`}
          aria-label={`${t.title}: ${t.done ? "done" : "to do"}. ${t.detail}`}
        >
          <div className="flex items-center gap-2">
            <span
              aria-hidden
              className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border font-mono text-[9px] ${t.done ? "border-ion bg-ion text-obsidian" : "border-porcelain/25 text-porcelain/40"}`}
            >
              {t.done ? "✓" : i + 1}
            </span>
            <span className={`truncate text-xs font-medium ${t.done ? "text-porcelain" : "text-porcelain/70"}`}>{t.title}</span>
          </div>
          <p className="mt-0.5 truncate pl-6 text-[11px] text-porcelain/45" title={t.detail}>
            {t.detail}
          </p>
        </li>
      ))}
    </ol>
  );
}

function Badges({ items }: { items: Achievement[] }) {
  return (
    <ul className="grid grid-cols-1 gap-1.5" aria-label="Achievements">
      {items.map((a) => (
        <li key={a.id} className={`flex items-start gap-2.5 rounded-lg px-2 py-1.5 ${a.earned ? "" : "opacity-45"}`}>
          <span
            aria-hidden
            className={`mt-0.5 flex h-6 w-6 shrink-0 rotate-45 items-center justify-center rounded-[5px] border ${a.earned ? "border-ion/60 bg-ion/15" : "border-porcelain/20"}`}
          >
            <span className={`-rotate-45 text-[10px] ${a.earned ? "text-ion" : "text-porcelain/40"}`}>{a.earned ? "✓" : "·"}</span>
          </span>
          <span className="min-w-0">
            <span className="block text-xs font-medium">{a.title}</span>
            <span className="block text-[11px] text-porcelain/50">{a.earnedFor}</span>
          </span>
          <span className="sr-only">{a.earned ? "earned" : "not earned yet"}</span>
        </li>
      ))}
    </ul>
  );
}

/** Header control: case progress (real tasks done) with a panel listing tasks and achievements. */
export function CaseProgressButton() {
  const { tasks, achievements, done, total } = useCaseProgress();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onClick = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onClick);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onClick);
    };
  }, [open]);
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((o) => !o)}
        className="press flex items-center gap-2 rounded-full border border-porcelain/15 px-2.5 py-1 text-xs hover:border-ion/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-ion"
      >
        <span aria-hidden className="relative h-1.5 w-12 overflow-hidden rounded-full bg-porcelain/10">
          <span className="absolute inset-y-0 left-0 rounded-full bg-ion transition-[width] duration-500" style={{ width: `${(done / total) * 100}%` }} />
        </span>
        <span className="font-mono tabular-nums">
          {done}/{total}
        </span>
        <span className="sr-only">case tasks done</span>
      </button>
      {open && (
        <div role="dialog" aria-label="Case progress" className="anim-fade-up surface absolute right-0 top-10 z-50 w-[min(22rem,90vw)] rounded-2xl p-4">
          <h2 className="font-mono text-[10px] uppercase tracking-[0.2em] text-ion">Case progress</h2>
          <p className="mt-1 text-[11px] text-porcelain/50">Counts actions you have really completed. Finishing the case does not mean the device is compliant or approved.</p>
          <div className="mt-3">
            <MissionTasks tasks={tasks} compact />
          </div>
          <h3 className="mt-4 font-mono text-[10px] uppercase tracking-[0.2em] text-porcelain/50">Achievements</h3>
          <div className="mt-1">
            <Badges items={achievements} />
          </div>
        </div>
      )}
    </div>
  );
}

/** A brief, polite notice when an achievement is genuinely earned in this session. */
export function AchievementToast() {
  const { achievements, workspaceId, ready } = useCaseProgress();
  const seen = useRef<{ ws: string; ids: Set<string> } | null>(null);
  const [toast, setToast] = useState<Achievement | null>(null);
  const earned = achievements.filter((a) => a.earned).map((a) => a.id).join(",");
  useEffect(() => {
    if (!ready) return;
    const ids = new Set(earned ? earned.split(",") : []);
    // The first state seen for a case (page load, case switch) is the baseline, not a new achievement.
    if (!seen.current || seen.current.ws !== workspaceId) {
      seen.current = { ws: workspaceId, ids };
      return;
    }
    const fresh = achievements.find((a) => a.earned && !seen.current!.ids.has(a.id));
    seen.current.ids = ids;
    if (!fresh) return;
    const show = setTimeout(() => setToast(fresh), 0);
    const hide = setTimeout(() => setToast(null), 4200);
    return () => {
      clearTimeout(show);
      clearTimeout(hide);
    };
  }, [earned, workspaceId, achievements, ready]);
  return (
    <div aria-live="polite" className="pointer-events-none fixed bottom-5 left-1/2 z-50 -translate-x-1/2 print:hidden">
      {toast && (
        <div className="anim-fade-up surface flex items-center gap-3 rounded-full px-4 py-2 text-sm">
          <span aria-hidden className="flex h-5 w-5 rotate-45 items-center justify-center rounded-[4px] border border-ion/60 bg-ion/15">
            <span className="-rotate-45 text-[10px] text-ion">✓</span>
          </span>
          <span>
            <strong className="font-semibold">{toast.title}</strong> <span className="text-porcelain/60">— {toast.earnedFor}</span>
          </span>
        </div>
      )}
    </div>
  );
}
