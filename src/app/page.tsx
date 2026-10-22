"use client";

import Link from "next/link";
import { LoadDemoButton } from "@/components/evidence";
import { Badge, Card, DemoNotice, PageHeader } from "@/components/ui";
import { crossCheck } from "@/lib/checks";
import { getRequirementSet, SYNTHETIC_DEMO_SET } from "@/lib/requirements";
import { useAppState, useToday } from "@/lib/store";
import { useResults } from "@/lib/use-results";
import { useUploads } from "@/lib/use-uploads";
import { useGapReport } from "@/lib/use-report";

export default function OverviewPage() {
  const state = useAppState();
  const today = useToday();
  const { uploads, refresh: refreshUploads } = useUploads(state.workspaceId);
  const r = useResults(state.workspaceId);
  const set = getRequirementSet(state.requirementSetId) ?? SYNTHETIC_DEMO_SET;
  const mapping = r.mapping?.requirementSetId === set.id ? r.mapping : null;
  const findings = crossCheck(r.analysis, state.workspace, today);
  const discrepancies = findings.filter((f) => f.severity === "fail").length;
  const gaps = mapping?.rows.filter((x) => x.status !== "found").length ?? null;
  const { report } = useGapReport();
  const reviewed = report.counts.reviewed;

  const stats = [
    { label: "Documents", value: uploads.length, href: "/documents" },
    { label: "Requirements not shown as found", value: gaps === null ? "—" : `${gaps} / ${set.requirements.length}`, href: "/evidence-matrix" },
    { label: "Exact-value discrepancies", value: r.analysis ? discrepancies : "—", href: "/consistency-checks" },
    { label: "Items reviewed by a human", value: `${reviewed} / ${reviewed + report.counts.awaitingReview}`, href: "/readiness-report" },
  ];

  return (
    <>
      <PageHeader
        title="Overview"
        subtitle="Find missing or inconsistent evidence in a product's documentation before a human regulatory review."
      />
      {state.isDemo && (
        <DemoNotice>
          FICTIONAL DEMO DOSSIER — not a real device, company or certificate.{" "}
          {uploads.length === 0 && (
            <LoadDemoButton
              onLoaded={() => {
                r.refresh();
                refreshUploads();
              }}
            />
          )}
        </DemoNotice>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Link key={s.label} href={s.href} className="rounded-lg border border-line bg-white p-5 transition-colors hover:border-teal">
            <div className="text-3xl font-semibold text-ink">{s.value}</div>
            <div className="mt-1 text-sm text-ink-soft">{s.label}</div>
          </Link>
        ))}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card title="Current workspace">
          <dl className="space-y-2 text-sm">
            {(
              [
                ["Device", state.workspace.deviceName.value],
                ["Manufacturer", state.workspace.manufacturer.value],
                ["Model", state.workspace.modelNumber.value],
                ["Classification", state.workspace.classification.value],
                ["Pathway", state.workspace.pathway.value],
              ] as const
            ).map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4">
                <dt className="text-mute">{k}</dt>
                <dd className="text-right text-ink">{v || "—"}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-4">
            <Link href="/workspace" className="text-sm font-medium text-teal hover:underline">
              Edit workspace →
            </Link>
          </div>
        </Card>

        <Card title="Verification status">
          <ul className="space-y-3 text-sm text-ink-soft">
            <li className="flex items-start justify-between gap-3">
              <span>Requirement set: {set.name}</span>
              {set.verification === "official_text" ? (
                <Badge tone="teal">Official text, scenario-limited</Badge>
              ) : (
                <Badge tone="demo">Synthetic demo</Badge>
              )}
            </li>
            <li className="flex items-start justify-between gap-3">
              <span>AI (Gemini)</span>
              {r.loading ? (
                <Badge>Checking…</Badge>
              ) : r.aiConfigured ? (
                <Badge tone="teal">Key configured on server</Badge>
              ) : (
                <Badge tone="warn">No API key set</Badge>
              )}
            </li>
            <li className="flex items-start justify-between gap-3">
              <span>Quotations</span>
              <Badge tone="teal">Verified by code against PDF text</Badge>
            </li>
            <li className="flex items-start justify-between gap-3">
              <span>Final decisions</span>
              <Badge>Human reviewer</Badge>
            </li>
          </ul>
        </Card>
      </div>
    </>
  );
}
