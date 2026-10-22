"use client";

import { Button, Card, PageHeader } from "@/components/ui";
import { getRequirementSet, scenarioApplicability, SYNTHETIC_DEMO_SET } from "@/lib/requirements";
import { refreshShared } from "@/lib/shared-fetch";
import { actions, useAppState } from "@/lib/store";
import type { Classification, WorkspaceFieldKey } from "@/lib/types";

const CLASSES: Classification[] = ["Not yet classified", "Class A", "Class B", "Class C", "Class D"];
const PATHWAYS = [
  "Not yet decided",
  "Manufacturing licence — Class A/B (State Licensing Authority)",
  "Manufacturing licence — Class C/D (Central Licensing Authority)",
  "Import licence",
];

type Field = {
  key: WorkspaceFieldKey;
  label: string;
  kind: "text" | "textarea" | "select";
  options?: string[];
  confirmHint: string;
  placeholder?: string;
};

const GROUPS: { title: string; description: string; fields: Field[] }[] = [
  {
    title: "Device information",
    description: "How the device is identified in your documents.",
    fields: [
      { key: "deviceName", label: "Device name", kind: "text", confirmHint: "Check it matches the device master file and label.", placeholder: "e.g. Fingertip Pulse Oximeter" },
      { key: "modelNumber", label: "Model number", kind: "text", confirmHint: "Used to cross-check every document — confirm it against the label.", placeholder: "e.g. AP-200A" },
    ],
  },
  {
    title: "Manufacturer information",
    description: "The legal manufacturer named on the application.",
    fields: [{ key: "manufacturer", label: "Manufacturer", kind: "text", confirmHint: "Confirm the legal name against the company registration." }],
  },
  {
    title: "Intended use and technical details",
    description: "What the device is for and who it is for.",
    fields: [{ key: "intendedUse", label: "Intended use", kind: "textarea", confirmHint: "Confirm it matches the intended-use statement in the device master file." }],
  },
  {
    title: "Regulatory classification and pathway",
    description: "These decide which requirements apply. Evidentra never changes them for you.",
    fields: [
      { key: "classification", label: "Risk class (MDR 2017)", kind: "select", options: CLASSES, confirmHint: "Confirm with CDSCO's classification resources." },
      { key: "pathway", label: "Application pathway", kind: "select", options: PATHWAYS, confirmHint: "Confirm the authority and form on the CDSCO online portal." },
    ],
  },
];

const INPUT =
  "w-full rounded-md border border-line bg-white px-3 py-2 text-sm text-ink placeholder:text-mute focus:border-teal focus:outline-none focus-visible:ring-2 focus-visible:ring-teal/40";

const isUnset = (v: string) => !v.trim() || v === "Not yet decided" || v === "Not yet classified";

export default function WorkspacePage() {
  const state = useAppState();
  const keys = GROUPS.flatMap((g) => g.fields.map((f) => f.key));
  const confirmed = keys.filter((k) => state.workspace[k].verified).length;
  const unset = keys.filter((k) => isUnset(state.workspace[k].value));
  const set = getRequirementSet(state.requirementSetId) ?? SYNTHETIC_DEMO_SET;
  const applicability = scenarioApplicability(set, state.workspace);

  return (
    <>
      <PageHeader
        title="Workspace"
        subtitle="Describe the product you are preparing. Saved automatically in this browser."
        actions={
          <>
            <Button onClick={() => actions.startBlank()}>Start a new workspace</Button>
            <Button
              onClick={async () => {
                actions.resetDemo();
                // Re-create the demo dossier on the server (real PDFs + verified seed), then refresh views.
                await fetch("/api/demo/load", { method: "POST" }).catch(() => null);
                refreshShared("");
              }}
            >
              Reload demo
            </Button>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_17rem]">
        <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
          {GROUPS.map((g) => (
            <Card key={g.title}>
              <h2 className="text-sm font-semibold text-ink">{g.title}</h2>
              <p className="mb-4 text-xs text-mute">{g.description}</p>
              <div className="grid gap-5 md:grid-cols-2">
                {g.fields.map((f) => {
                  const field = state.workspace[f.key];
                  const id = `field-${f.key}`;
                  const empty = isUnset(field.value);
                  return (
                    <div key={f.key} className={f.kind === "textarea" || g.fields.length === 1 ? "md:col-span-2" : ""}>
                      <label htmlFor={id} className="mb-1 block text-sm font-medium text-ink">
                        {f.label}
                      </label>
                      {f.kind === "text" && (
                        <input id={id} className={INPUT} value={field.value} placeholder={f.placeholder} onChange={(e) => actions.setField(f.key, e.target.value)} />
                      )}
                      {f.kind === "textarea" && (
                        <textarea id={id} rows={3} className={INPUT} value={field.value} onChange={(e) => actions.setField(f.key, e.target.value)} />
                      )}
                      {f.kind === "select" && (
                        <select id={id} className={INPUT} value={field.value} onChange={(e) => actions.setField(f.key, e.target.value)}>
                          {f.options!.map((o) => (
                            <option key={o}>{o}</option>
                          ))}
                        </select>
                      )}
                      <label className="mt-2 flex items-start gap-2 text-xs">
                        <input
                          type="checkbox"
                          className="mt-0.5"
                          aria-label={`Confirm ${f.label.toLowerCase()}`}
                          checked={field.verified}
                          disabled={empty}
                          onChange={(e) => actions.setVerified(f.key, e.target.checked)}
                        />
                        <span className={field.verified ? "text-teal-dark" : empty ? "text-mute" : "text-warn"}>
                          {field.verified ? "Confirmed by you against a source document" : empty ? "Enter a value first" : `Not confirmed yet. ${f.confirmHint}`}
                        </span>
                      </label>
                    </div>
                  );
                })}
              </div>
            </Card>
          ))}
        </form>

        <aside className="space-y-4">
          <Card title="Verification status">
            <div className="text-2xl font-semibold tabular-nums text-ink">
              {confirmed} <span className="text-base font-normal text-mute">of {keys.length}</span>
            </div>
            <p className="text-xs text-ink-soft">fields confirmed by you</p>
            {unset.length > 0 && <p className="mt-3 text-xs text-warn">Still to fill in: {unset.length} field(s).</p>}
            <p className="mt-3 text-xs text-mute">Editing a value removes its confirmation, so you re-check what changed.</p>
          </Card>
          {applicability && (
            <Card title="Requirement scope">
              <p className={`text-xs ${applicability.applicable ? "text-teal-dark" : "text-warn"}`}>
                {applicability.applicable
                  ? "The official requirement list applies to this class and pathway."
                  : "We need to confirm whether the official requirement list applies to this class and pathway."}
              </p>
              {applicability.basedOnUnverifiedFields && <p className="mt-2 text-xs text-mute">Based on fields you have not confirmed yet.</p>}
            </Card>
          )}
          {state.isDemo && (
            <p className="text-xs text-demo">This is the fictional demo workspace. Edit freely, or start a new workspace for your own product.</p>
          )}
        </aside>
      </div>
    </>
  );
}
