"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useGapReport } from "@/lib/use-report";
import { Badge } from "./ui";

const NAV = [
  { href: "/", label: "Overview" },
  { href: "/workspace", label: "Workspace" },
  { href: "/documents", label: "Documents" },
  { href: "/evidence-matrix", label: "Evidence Review" },
  { href: "/consistency-checks", label: "Consistency Checks" },
  { href: "/readiness-report", label: "Gap Report" },
];

type StepState = "done" | "active" | "todo";

/** Workflow progress, derived only from real state (never from which pages were opened). */
function WorkflowSteps() {
  const pathname = usePathname();
  const { state, report, loading } = useGapReport();
  const ws = state.workspace;
  const assessed = report.requirements.filter((r) => r.display !== "not_assessed");
  const reqOpen = assessed.filter((r) => !r.humanReviewed && !r.dismissed).length;
  const findOpen = report.findings.filter((f) => !f.humanReviewed && !f.dismissed).length;
  const wsDone =
    Boolean(ws.deviceName.value.trim() && ws.modelNumber.value.trim()) &&
    ws.classification.value !== "Not yet classified" &&
    ws.pathway.value !== "Not yet decided";

  const steps: { href: string; label: string; state: StepState; note: string }[] = [
    { href: "/workspace", label: "Workspace", state: wsDone ? "done" : "active", note: wsDone ? "Details entered" : "Details needed" },
    {
      href: "/documents",
      label: "Documents",
      state: report.documents.usable > 0 ? "done" : "todo",
      note: report.documents.usable > 0 ? `${report.documents.usable} readable` : "None yet",
    },
    {
      href: "/evidence-matrix",
      label: "Evidence Review",
      state: report.mapping ? (reqOpen === 0 ? "done" : "active") : "todo",
      note: report.mapping ? (reqOpen ? `${reqOpen} to review` : "All reviewed") : "Not analyzed",
    },
    {
      href: "/consistency-checks",
      label: "Consistency Checks",
      state: report.analysis ? (findOpen === 0 ? "done" : "active") : "todo",
      note: report.analysis ? (findOpen ? `${findOpen} to review` : "All reviewed") : "Not analyzed",
    },
    {
      href: "/readiness-report",
      label: "Gap Report",
      state: report.mapping && report.analysis ? "active" : "todo",
      note: report.mapping && report.analysis ? "Ready to view" : "Needs analysis",
    },
  ];

  return (
    <nav aria-label="Workflow" className="no-print overflow-x-auto">
      <ol className="flex min-w-max items-center gap-1 text-xs">
        {steps.map((s, i) => {
          const current = pathname.startsWith(s.href);
          return (
            <li key={s.href} className="flex items-center gap-1">
              <Link
                href={s.href}
                aria-current={current ? "step" : undefined}
                className={`flex items-center gap-2 rounded-md px-2.5 py-1.5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-teal ${
                  current ? "bg-teal-soft" : "hover:bg-background"
                }`}
              >
                <span
                  aria-hidden
                  className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold ${
                    s.state === "done" ? "bg-teal text-white" : s.state === "active" ? "border border-teal text-teal-dark" : "border border-line text-mute"
                  }`}
                >
                  {s.state === "done" ? "✓" : i + 1}
                </span>
                <span>
                  <span className={`block font-medium ${current ? "text-teal-dark" : "text-ink"}`}>{s.label}</span>
                  <span className="block text-[11px] text-mute">{loading ? "…" : s.note}</span>
                </span>
              </Link>
              {i < steps.length - 1 && <span aria-hidden className="px-0.5 text-line">—</span>}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { state } = useGapReport();

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="no-print border-b border-line bg-white md:sticky md:top-0 md:h-screen md:w-60 md:shrink-0 md:border-b-0 md:border-r">
        <div className="flex h-full flex-col">
          <div className="px-5 py-4">
            <div className="text-lg font-semibold tracking-tight text-ink">
              Evidentra<span className="text-teal">.</span>
            </div>
            <div className="text-xs text-mute">Pre-submission documentation review</div>
          </div>
          <nav aria-label="Main" className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col md:pb-0">
            {NAV.map((item) => {
              const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`whitespace-nowrap rounded-md px-3 py-2 text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-teal ${
                    active ? "bg-teal-soft font-medium text-teal-dark" : "text-ink-soft hover:bg-background hover:text-ink"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <p className="mt-auto hidden px-5 py-5 text-[11px] leading-relaxed text-mute md:block">
            Evidentra highlights documentation gaps for a qualified reviewer. It does not certify compliance or predict CDSCO
            approval. AI output is a suggestion until a person reviews it.
          </p>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print border-b border-line bg-white/80 px-5 py-2.5 backdrop-blur">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-1.5 2xl:flex-row 2xl:items-center 2xl:justify-between">
            <div className="flex min-w-0 items-center gap-2 text-sm">
              <span className="truncate font-medium text-ink">{state.workspace.deviceName.value || "Untitled workspace"}</span>
              {state.isDemo ? <Badge tone="demo">Demo — fictional data</Badge> : <Badge>Your workspace</Badge>}
            </div>
            <WorkflowSteps />
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-8">{children}</main>
        <footer className="no-print px-5 pb-6 text-center text-[11px] text-mute md:hidden">
          Evidentra highlights documentation gaps for a qualified reviewer. It does not certify compliance or predict CDSCO approval.
        </footer>
      </div>
    </div>
  );
}
