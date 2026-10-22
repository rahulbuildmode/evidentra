import type { ReactNode } from "react";

type Tone = "teal" | "demo" | "warn" | "bad" | "neutral";

const TONES: Record<Tone, string> = {
  teal: "bg-teal-soft text-teal-dark",
  demo: "bg-demo-soft text-demo",
  warn: "bg-warn-soft text-warn",
  bad: "bg-bad-soft text-bad",
  neutral: "bg-line/60 text-ink-soft",
};

export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${TONES[tone]}`}
    >
      {children}
    </span>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
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
}: {
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-lg border border-line bg-white p-5 ${className}`}>
      {title && <h2 className="mb-3 text-sm font-semibold text-ink">{title}</h2>}
      {children}
    </section>
  );
}

const BTN =
  "inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-teal disabled:cursor-not-allowed disabled:opacity-50";

export function Button({
  variant = "secondary",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "danger" }) {
  const styles = {
    primary: "bg-teal text-white hover:bg-teal-dark",
    secondary: "border border-line bg-white text-ink hover:bg-background",
    danger: "border border-bad/30 bg-white text-bad hover:bg-bad-soft",
  }[variant];
  return <button type="button" {...props} className={`${BTN} ${styles} ${props.className ?? ""}`} />;
}

export function DemoNotice({ children }: { children?: ReactNode }) {
  return (
    <div className="mb-5 rounded-md border border-demo/20 bg-demo-soft px-4 py-2 text-xs text-demo">
      {children ?? "FICTIONAL DEMO DATA — not a real device, company or certificate."}
    </div>
  );
}
