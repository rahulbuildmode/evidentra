"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Evidentra design primitives. Colour carries meaning only:
 *   teal = verified / positive · warn = needs attention · bad = problem
 *   demo = fictional demo data · ai = AI suggestion · neutral = informational
 * Every status also has a text label (never colour alone).
 */

export type Tone = "teal" | "demo" | "warn" | "bad" | "neutral" | "ai";

const TONES: Record<Tone, string> = {
  teal: "border-teal/25 bg-teal-soft text-teal-dark",
  demo: "border-demo/25 bg-demo-soft text-demo",
  warn: "border-warn/25 bg-warn-soft text-warn",
  bad: "border-bad/25 bg-bad-soft text-bad",
  neutral: "border-line bg-white text-ink-soft",
  ai: "border-ink/20 bg-white text-ink",
};

const DOTS: Record<Tone, string> = {
  teal: "bg-teal",
  demo: "bg-demo",
  warn: "bg-warn",
  bad: "bg-bad",
  neutral: "bg-mute",
  ai: "bg-ink",
};

/** A meaningful state. Use sparingly: not for filenames, values or ordinary metadata. */
export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-md border px-1.5 py-0.5 text-[11px] font-medium leading-4 ${TONES[tone]}`}
    >
      {children}
    </span>
  );
}

/** Quiet status: coloured dot + text. Default way to show status in lists and tables. */
export function StatusDot({ tone, children, strong = false }: { tone: Tone; children: ReactNode; strong?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-sm ${strong ? "font-medium text-ink" : "text-ink-soft"}`}>
      <span aria-hidden className={`h-2 w-2 shrink-0 rounded-full ${DOTS[tone]}`} />
      {children}
    </span>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">{title}</h1>
        {subtitle && <p className="mt-1 max-w-2xl text-sm text-ink-soft">{subtitle}</p>}
      </div>
      {actions && <div className="no-print flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Card({
  title,
  children,
  className = "",
  actions,
}: {
  title?: ReactNode;
  children: ReactNode;
  className?: string;
  actions?: ReactNode;
}) {
  return (
    <section className={`rounded-xl border border-line bg-white p-5 ${className}`}>
      {(title || actions) && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          {title && <h2 className="text-sm font-semibold text-ink">{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

const BTN =
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50";

export function Button({
  variant = "secondary",
  size = "md",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md";
}) {
  const styles = {
    primary: "bg-teal text-white hover:bg-teal-dark",
    secondary: "border border-line bg-white text-ink hover:bg-background",
    danger: "border border-bad/30 bg-white text-bad hover:bg-bad-soft",
    ghost: "text-teal-dark hover:bg-teal-soft",
  }[variant];
  const sizes = size === "sm" ? "px-2.5 py-1 text-xs" : "px-3 py-2 text-sm";
  return <button type="button" {...props} className={`${BTN} ${sizes} ${styles} ${props.className ?? ""}`} />;
}

/** Small summary number. */
export function Stat({ label, value, tone = "neutral", hint }: { label: string; value: ReactNode; tone?: Tone; hint?: string }) {
  const color = tone === "bad" ? "text-bad" : tone === "warn" ? "text-warn" : tone === "teal" ? "text-teal-dark" : "text-ink";
  return (
    <div className="min-w-0">
      <div className={`text-2xl font-semibold tabular-nums ${color}`}>{value}</div>
      <div className="text-xs text-ink-soft">{label}</div>
      {hint && <div className="text-[11px] text-mute">{hint}</div>}
    </div>
  );
}

/** Collapsible section that opens itself for printing. */
export function Disclosure({
  title,
  count,
  children,
  defaultOpen = false,
  id,
}: {
  title: string;
  count?: number;
  children: ReactNode;
  defaultOpen?: boolean;
  id?: string;
}) {
  return (
    <details id={id} open={defaultOpen} className="group rounded-xl border border-line bg-white" data-print-open>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-5 py-3 text-sm font-semibold text-ink hover:bg-background focus:outline-none focus-visible:ring-2 focus-visible:ring-teal">
        <span>
          {title}
          {count !== undefined && <span className="ml-2 font-normal text-mute">{count}</span>}
        </span>
        <span aria-hidden className="text-mute transition-transform group-open:rotate-90">
          ›
        </span>
      </summary>
      <div className="border-t border-line px-5 py-4">{children}</div>
    </details>
  );
}

/** Right-hand detail panel. Esc or the close button closes it; focus moves into it on open. */
export function Drawer({
  open,
  onClose,
  title,
  eyebrow,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  eyebrow?: ReactNode;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      prev?.focus?.();
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="no-print fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label={typeof title === "string" ? title : "Details"}>
      <button type="button" aria-label="Close details" className="absolute inset-0 bg-ink/20" onClick={onClose} />
      <div
        ref={ref}
        tabIndex={-1}
        className="relative flex h-full w-full max-w-xl flex-col overflow-hidden bg-white shadow-2xl focus:outline-none"
      >
        <div className="flex items-start justify-between gap-3 border-b border-line px-6 py-4">
          <div className="min-w-0">
            {eyebrow && <div className="mb-1 text-xs text-mute">{eyebrow}</div>}
            <h2 className="text-lg font-semibold leading-snug text-ink">{title}</h2>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
        <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

/** A labelled block inside a drawer. */
export function DetailSection({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-mute">{label}</h3>
      <div className="text-sm text-ink">{children}</div>
    </section>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-line bg-white px-6 py-8 text-center">
      <div className="text-sm font-medium text-ink">{title}</div>
      {children && <div className="mt-1 text-sm text-ink-soft">{children}</div>}
    </div>
  );
}

/** Inline notice for one specific problem. */
export function Notice({ tone = "neutral", children, role }: { tone?: "warn" | "bad" | "neutral" | "demo"; children: ReactNode; role?: string }) {
  const styles = {
    warn: "border-warn/25 bg-warn-soft text-warn",
    bad: "border-bad/25 bg-bad-soft text-bad",
    neutral: "border-line bg-white text-ink-soft",
    demo: "border-demo/25 bg-demo-soft text-demo",
  }[tone];
  return (
    <div role={role} className={`rounded-lg border px-4 py-2.5 text-sm ${styles}`}>
      {children}
    </div>
  );
}
