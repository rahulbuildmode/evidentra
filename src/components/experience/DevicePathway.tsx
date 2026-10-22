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
        <p role="alert" className="sm:col-span-2 text-sm text-crimson">
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
  const tone = d?.status === "in_scope" ? "border-ion/40" : d?.status === "out_of_scope" ? "border-crimson/50" : "border-lime/50";

  return (
    <section aria-labelledby="pathway-title" className="panel mt-6 rounded-2xl p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="font-mono text-[11px] uppercase tracking-[0.24em] text-ion">Step 2 · Device and pathway</div>
          <h3 id="pathway-title" className="mt-1 text-xl font-semibold">
            Confirm what is being validated
          </h3>
          <p className="mt-1 max-w-2xl text-sm text-porcelain/60">
            Applicability of each CDSCO requirement is decided by code from these details — never by the AI. Leave anything you are unsure of as
            “Not sure yet”.
          </p>
        </div>
        {profile?.origin === "demo" && (
          <span className="rounded-full border border-lime/60 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.2em] text-lime">Synthetic demo data</span>
        )}
      </div>

      {error && <p className="mt-3 text-sm text-crimson">{error}</p>}
      {profile && !editing && (
        <div className="mt-4 grid gap-4 md:grid-cols-[1fr_1.2fr]">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <dt className="text-porcelain/50">Device</dt>
            <dd>{profile.deviceName || "Not stated"}</dd>
            <dt className="text-porcelain/50">Manufacturer</dt>
            <dd>{profile.manufacturer || "Not stated"}</dd>
            <dt className="text-porcelain/50">Category</dt>
            <dd>{profile.deviceCategory || "Not stated"}</dd>
            <dt className="text-porcelain/50">Risk class</dt>
            <dd>
              {profile.riskClass === "unknown" ? "Not stated" : `Class ${profile.riskClass}`}{" "}
              {profile.riskClass !== "unknown" && (
                <span className={profile.riskClassConfirmed ? "text-ion" : "text-lime"}>· {profile.riskClassConfirmed ? "confirmed by you" : "not confirmed"}</span>
              )}
            </dd>
            <dt className="text-porcelain/50">Activity</dt>
            <dd>{profile.activity === "unknown" ? "Not stated" : profile.activity === "manufacture" ? "Manufacture in India" : "Import"}</dd>
            <dt className="text-porcelain/50">IVD</dt>
            <dd>{TRI[profile.ivd]}</dd>
            <dt className="text-porcelain/50">Application</dt>
            <dd>{profile.licenceType === "unknown" ? "Not stated" : profile.licenceType === "licence" ? "Licence" : "Loan licence"}</dd>
            <dt className="text-porcelain/50">Test licence</dt>
            <dd>{TRI[profile.testLicence]}</dd>
          </dl>
          <div className={`rounded-xl border p-4 text-sm ${tone}`}>
            <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-porcelain/50">Pathway decision (code)</div>
            <div className="mt-1 font-semibold">{d?.label ?? "…"}</div>
            {d?.form && <div className="mt-1 text-porcelain/70">{d.form}</div>}
            {d?.reasons.map((r) => (
              <p key={r} className="mt-1 text-xs text-lime">
                {r}
              </p>
            ))}
            <p className="mt-3 text-xs text-porcelain/55">
              Library v{MFG_LICENCE_BCD.libraryVersion} · {MFG_LICENCE_BCD.requirements.length} selected items · checked {MFG_LICENCE_BCD.lastReviewed} against{" "}
              <a href={MFG_LICENCE_BCD.source.url} target="_blank" rel="noreferrer" className="underline underline-offset-2">
                MDR 2017 (CDSCO PDF, as amended to 14 Oct 2022) ↗
              </a>
              . Supported: {MFG_LICENCE_BCD.name}. Not covered: import, Class A, IVD, loan licences.
            </p>
          </div>
          <div className="md:col-span-2">
            <button type="button" onClick={() => setEditing(true)} className="press rounded-full border border-ion/50 px-4 py-1.5 text-xs font-medium text-ion hover:bg-ion/10">
              Edit device and pathway
            </button>
          </div>
        </div>
      )}
      {profile && editing && <Form initial={profile} workspaceId={ws} onDone={() => setEditing(false)} />}
    </section>
  );
}
