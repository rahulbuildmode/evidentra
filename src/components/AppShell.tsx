"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAppState } from "@/lib/store";
import { Badge } from "./ui";

const NAV = [
  { href: "/", label: "Overview" },
  { href: "/workspace", label: "Submission Workspace" },
  { href: "/documents", label: "Documents" },
  { href: "/evidence-matrix", label: "Evidence Matrix" },
  { href: "/consistency-checks", label: "Consistency Checks" },
  { href: "/readiness-report", label: "Gap Report" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { isDemo } = useAppState();

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="no-print border-b border-line bg-white md:min-h-screen md:w-64 md:shrink-0 md:border-b-0 md:border-r">
        <div className="flex items-center justify-between px-5 py-4 md:block">
          <div>
            <div className="text-lg font-semibold tracking-tight text-ink">
              Evidentra
              <span className="text-teal">.</span>
            </div>
            <div className="text-xs text-mute">Regulatory documentation copilot</div>
          </div>
          <div className="md:mt-3">
            {isDemo ? (
              <Badge tone="demo">Demo workspace</Badge>
            ) : (
              <Badge tone="teal">Your workspace</Badge>
            )}
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col md:pb-0">
          {NAV.map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`whitespace-nowrap rounded-md px-3 py-2 text-sm transition-colors ${
                  active
                    ? "bg-teal-soft font-medium text-teal-dark"
                    : "text-ink-soft hover:bg-background hover:text-ink"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <p className="hidden px-5 py-4 text-xs leading-relaxed text-mute md:block">
          Evidentra helps spot missing or inconsistent evidence. It is not legal advice and does
          not certify compliance. A qualified person must make every regulatory decision.
        </p>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="no-print border-b border-warn/20 bg-warn-soft px-5 py-2 text-xs text-warn">
          <strong>Not a compliance tool.</strong> Requirements are labelled as official (checked against
          MDR 2017 text as amended to 14 Oct 2022, for a limited scenario) or synthetic demo data. AI
          output is a suggestion until a person reviews it. Confirm everything against current CDSCO sources.
        </div>
        <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-8">{children}</main>
      </div>
    </div>
  );
}
