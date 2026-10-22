"use client";

import { useState } from "react";
import { MFG_LICENCE_BCD } from "@/lib/regulatory/library";
import type { DeviceProfile } from "@/lib/regulatory/types";
import { refreshShared } from "@/lib/shared-fetch";
import { useGapReport } from "@/lib/use-report";
import { useProfile, useValidation } from "@/lib/use-validation";

type Editable = Omit<DeviceProfile, "origin" | "updatedAt">;

const field = "mt-1 block w-full rounded-lg border hairline bg-obsidian px-3 py-2 text-sm text-porcelain focus:outline-none focus-visible:ring-2 focus-visible:ring-ion";
const lbl = "block text-xs text-porcelain/60";

function Select<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <label className={lbl}>
      {label}
      <select value={value} onChange={(e) => onChange(e.target.value as T)} className={field}>
        {options.map(([v, t]) => (
          <option key={v} value={v}>
            {t}
          </option>
        ))}
      </select>
    </label>
  );
}

function Form({ initial, workspaceId, onDone }: { initial: Editable; workspaceId: string; onDone: () => void }) {
  const [p, setP] = useState<Editable>(initial);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof Editable>(k: K, v: Editable[K]) => setP((x) => ({ ...x, [k]: v }));
  async function save() {
    setSaving(true);
    setError(null);
    const res = await fetch("/api/profile", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ workspaceId, profile: p }),
    }).catch(() => null);
    const j = await res?.json().catch(() => ({}));
    setSaving(false);
    if (!res?.ok) return setError(j?.error ?? "Could not reach the app server.");
    await refreshShared(`results:${workspaceId}`);
    onDone();
  }
  return (
    <form
      className="mt-4 grid gap-3 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <label className={lbl}>
        Device name
        <input value={p.deviceName} onChange={(e) => set("deviceName", e.target.value)} className={field} maxLength={200} />
      </label>
      <label className={lbl}>
        Manufacturer
        <input value={p.manufacturer} onChange={(e) => set("manufacturer", e.target.value)} className={field} maxLength={200} />
      </label>
      <label className={`${lbl} sm:col-span-2`}>
        Intended use
        <textarea value={p.intendedUse} onChange={(e) => set("intendedUse", e.target.value)} className={field} rows={2} maxLength={1000} />
      </label>
      <label className={lbl}>
        Device category or type
        <input value={p.deviceCategory} onChange={(e) => set("deviceCategory", e.target.value)} className={field} maxLength={200} placeholder="e.g. pulse oximeter" />
      </label>
      <Select
        label="Manufacture or import"
        value={p.activity}
        onChange={(v) => set("activity", v)}
        options={[
          ["unknown", "Not sure yet"],
          ["manufacture", "Manufacture in India"],
          ["import", "Import"],
        ]}
      />
      <Select
        label="Risk class (MDR 2017)"
        value={p.riskClass}
        onChange={(v) => set("riskClass", v)}
        options={[
          ["unknown", "Not sure yet"],
          ["A", "Class A"],
          ["B", "Class B"],
          ["C", "Class C"],
          ["D", "Class D"],
        ]}
      />
      <Select
        label="In vitro diagnostic device?"
        value={p.ivd}
        onChange={(v) => set("ivd", v)}
        options={[
          ["unknown", "Not sure yet"],
          ["no", "No"],
          ["yes", "Yes"],
        ]}
      />
      <Select
        label="Application"
        value={p.licenceType}
        onChange={(v) => set("licenceType", v)}
        options={[
          ["unknown", "Not sure yet"],
          ["licence", "Licence"],
          ["loan_licence", "Loan licence"],
        ]}
      />
      <Select
        label="Test licence obtained?"
        value={p.testLicence}
        onChange={(v) => set("testLicence", v)}
        options={[
          ["unknown", "Not sure yet"],
          ["no", "No"],
          ["yes", "Yes"],
        ]}
      />
      <div className="sm:col-span-2 rounded-lg border hairline p-3">
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={p.riskClassConfirmed}
            disabled={p.riskClass === "unknown"}
            onChange={(e) => set("riskClassConfirmed", e.target.checked)}
            className="mt-1"
          />
          <span>I confirmed this risk class against the official CDSCO classification (not from the product name or an AI guess).</span>
        </label>
        <label className={`${lbl} mt-2`}>
          Basis for the class (optional)
          <input value={p.riskClassBasis} onChange={(e) => set("riskClassBasis", e.target.value)} className={field} maxLength={500} placeholder="e.g. CDSCO classification list, entry …" />
        </label>
      </div>
      {error && (
        <p role="alert" className="sm:col-span-2 text-sm text-coral">
          {error}
        </p>
      )}
      <div className="sm:col-span-2 flex gap-2">
        <button type="submit" disabled={saving} className="press rounded-full bg-ion px-5 py-2 text-sm font-semibold text-obsidian disabled:opacity-50">
          {saving ? "Saving…" : "Save and re-validate"}
        </button>
        <button type="button" onClick={onDone} className="press rounded-full border hairline px-4 py-2 text-sm text-porcelain">
          Cancel
        </button>
      </div>
    </form>
  );
}

const TRI = { yes: "Yes", no: "No", unknown: "Not stated" } as const;

/** Device and regulatory pathway, confirmed by a person before requirement-level validation. */
export function DevicePathway() {
  const { state } = useGapReport();
  const ws = state.workspaceId;
  const { profile, error } = useProfile(ws);
  const { report } = useValidation(ws);
  const [editing, setEditing] = useState(false);
  const d = report?.decision;
  const tone = d?.status === "in_scope" ? "border-ion/40" : d?.status === "out_of_scope" ? "border-coral/50" : "border-amber/50";

  const cls = !profile || profile.riskClass === "unknown" ? "Class not stated" : `Class ${profile.riskClass}${profile.riskClassConfirmed ? "" : " (unconfirmed)"}`;
  const activity = !profile || profile.activity === "unknown" ? "activity not stated" : profile.activity === "manufacture" ? "manufacture in India" : "import";

  return (
    <section aria-labelledby="pathway-title" className="rounded-xl border hairline p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id="pathway-title" className="font-mono text-[11px] uppercase tracking-[0.2em] text-porcelain/60">
          Device and pathway
        </h3>
        <div className="flex items-center gap-2">
          {profile?.origin === "demo" && <span className="rounded-full border border-dashed border-porcelain/40 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.16em] text-porcelain/75">Synthetic</span>}
          {profile && !editing && (
            <button type="button" onClick={() => setEditing(true)} className="press rounded-full border border-ion/50 px-3 py-1 text-xs text-ion hover:bg-ion/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-ion">
              Edit
            </button>
          )}
        </div>
      </div>
      {error && <p className="mt-2 text-sm text-coral">{error}</p>}
      {profile && !editing && (
        <div className="mt-2 space-y-2 text-sm">
          <p className="truncate font-medium" title={profile.deviceName}>
            {profile.deviceName || "Device not named yet"}
          </p>
          <p className="text-xs text-porcelain/60">
            {cls} · {activity} · IVD: {TRI[profile.ivd].toLowerCase()} · test licence: {TRI[profile.testLicence].toLowerCase()}
          </p>
          <div className={`rounded-lg border px-3 py-2 ${tone}`}>
            <div className="text-xs font-semibold">{d?.status === "in_scope" ? d.form : (d?.label ?? "…")}</div>
            {d?.reasons.slice(0, 1).map((r) => (
              <p key={r} className="mt-0.5 text-[11px] text-amber">
                {r}
              </p>
            ))}
            <p className="mt-1 text-[11px] text-porcelain/45">
              Applicability decided by code ·{" "}
              <a href={MFG_LICENCE_BCD.source.url} target="_blank" rel="noreferrer" className="underline underline-offset-2">
                MDR 2017 library v{MFG_LICENCE_BCD.libraryVersion}
              </a>
            </p>
          </div>
        </div>
      )}
      {profile && editing && <Form initial={profile} workspaceId={ws} onDone={() => setEditing(false)} />}
    </section>
  );
}
