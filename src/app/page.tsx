"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Badge, Card, DemoNotice, PageHeader } from "@/components/ui";
import { runChecks } from "@/lib/checks";
import { REQUIREMENTS, REQUIREMENT_SET } from "@/lib/requirements";
import { useAppState, useToday } from "@/lib/store";

function useAiStatus() {
  const [status, setStatus] = useState<"checking" | "ready" | "missing" | "error">("checking");
  useEffect(() => {
    let cancelled = false;
    fetch("/api/health")
      .then((r) => r.json())
      .then((j: { aiConfigured: boolean }) => {
        if (!cancelled) setStatus(j.aiConfigured ? "ready" : "missing");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return status;
}

export default function OverviewPage() {
  const state = useAppState();
  const ai = useAiStatus();
  const today = useToday();
  const findings = runChecks(state, today);
  const fails = findings.filter((f) => f.severity === "fail").length;
  const covered = state.evidence.filter((e) => e.suggestedStatus !== "not_found").length;
  const reviewed = Object.values(state.decisions).filter((d) => d !== "undecided").length;

  const stats = [
    { label: "Documents", value: state.documents.length, href: "/documents" },
    { label: "Requirements with suggested evidence", value: `${covered} / ${REQUIREMENTS.length}`, href: "/evidence-matrix" },
    { label: "Blocking inconsistencies", value: fails, href: "/consistency-checks" },
    { label: "Human reviews done", value: `${reviewed} / ${REQUIREMENTS.length}`, href: "/evidence-matrix" },
  ];

  return (
    <>
      <PageHeader
        title="Overview"
        subtitle="Find missing or inconsistent evidence in a product's documentation before a human regulatory review."
      />
      {state.isDemo && <DemoNotice />}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Link
            key={s.label}
            href={s.href}
            className="rounded-lg border border-line bg-white p-5 transition-colors hover:border-teal"
          >
            <div className="text-3xl font-semibold text-ink">{s.value}</div>
            <div className="mt-1 text-sm text-ink-soft">{s.label}</div>
          </Link>
        ))}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card title="Current workspace">
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-mute">Device</dt>
              <dd className="text-right text-ink">{state.workspace.deviceName.value || "—"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-mute">Manufacturer</dt>
              <dd className="text-right text-ink">{state.workspace.manufacturer.value || "—"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-mute">Model</dt>
              <dd className="text-right text-ink">{state.workspace.modelNumber.value || "—"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-mute">Classification</dt>
              <dd className="text-right text-ink">{state.workspace.classification.value}</dd>
            </div>
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
              <span>
                Requirement set: {REQUIREMENT_SET.name} <span className="text-mute">v{REQUIREMENT_SET.version}</span>
              </span>
              <Badge tone="warn">Unverified draft</Badge>
            </li>
            <li className="flex items-start justify-between gap-3">
              <span>AI analysis (Gemini)</span>
              {ai === "ready" && <Badge tone="teal">Key configured — analysis not built yet</Badge>}
              {ai === "missing" && <Badge tone="warn">No API key set</Badge>}
              {ai === "checking" && <Badge>Checking…</Badge>}
              {ai === "error" && <Badge tone="bad">Status unavailable</Badge>}
            </li>
            <li className="flex items-start justify-between gap-3">
              <span>Consistency checks</span>
              <Badge tone="teal">Deterministic code, runs now</Badge>
            </li>
          </ul>
        </Card>
      </div>
    </>
  );
}
