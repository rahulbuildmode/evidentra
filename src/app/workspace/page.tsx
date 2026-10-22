"use client";

import { Badge, Button, Card, DemoNotice, PageHeader } from "@/components/ui";
import { actions, useAppState } from "@/lib/store";
import type { Classification, WorkspaceFieldKey } from "@/lib/types";

const CLASSES: Classification[] = ["Not yet classified", "Class A", "Class B", "Class C", "Class D"];
const PATHWAYS = [
  "Not yet decided",
  "Manufacturing licence — Class A/B (State Licensing Authority)",
  "Manufacturing licence — Class C/D (Central Licensing Authority)",
  "Import licence",
];

const FIELDS: {
  key: WorkspaceFieldKey;
  label: string;
  kind: "text" | "textarea" | "select";
  options?: string[];
  help?: string;
}[] = [
  { key: "deviceName", label: "Device name", kind: "text" },
  { key: "manufacturer", label: "Manufacturer", kind: "text" },
  { key: "modelNumber", label: "Model number", kind: "text", help: "Used to cross-check the model number in your documents." },
  { key: "intendedUse", label: "Intended use", kind: "textarea" },
  {
    key: "classification",
    label: "Classification",
    kind: "select",
    options: CLASSES,
    help: "Risk class under MDR 2017 (A–D). Confirm with CDSCO's classification resources.",
  },
  {
    key: "pathway",
    label: "Regulatory pathway",
    kind: "select",
    options: PATHWAYS,
    help: "Which authority and form apply depends on class. Verify on the CDSCO portal.",
  },
];

const INPUT =
  "w-full rounded-md border border-line bg-white px-3 py-2 text-sm text-ink placeholder:text-mute focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal";

export default function WorkspacePage() {
  const state = useAppState();

  return (
    <>
      <PageHeader
        title="Submission Workspace"
        subtitle="Describe one product. Every field stays labelled 'Unverified' until you confirm it against a source document."
        actions={
          <>
            <Button onClick={() => actions.startBlank()}>Start blank workspace</Button>
            <Button onClick={() => actions.resetDemo()}>Reload demo</Button>
          </>
        }
      />
      {state.isDemo && <DemoNotice>FICTIONAL DEMO DATA — edit freely, or start a blank workspace for your own product.</DemoNotice>}

      <Card>
        <form className="grid gap-5 md:grid-cols-2" onSubmit={(e) => e.preventDefault()}>
          {FIELDS.map((f) => {
            const field = state.workspace[f.key];
            const id = `field-${f.key}`;
            const wide = f.kind === "textarea";
            return (
              <div key={f.key} className={wide ? "md:col-span-2" : ""}>
                <div className="mb-1 flex items-center justify-between gap-2">
                  <label htmlFor={id} className="text-sm font-medium text-ink">
                    {f.label}
                  </label>
                  {field.verified ? <Badge tone="teal">Verified by you</Badge> : <Badge tone="warn">Unverified</Badge>}
                </div>
                {f.kind === "text" && (
                  <input
                    id={id}
                    className={INPUT}
                    value={field.value}
                    onChange={(e) => actions.setField(f.key, e.target.value)}
                  />
                )}
                {f.kind === "textarea" && (
                  <textarea
                    id={id}
                    rows={3}
                    className={INPUT}
                    value={field.value}
                    onChange={(e) => actions.setField(f.key, e.target.value)}
                  />
                )}
                {f.kind === "select" && (
                  <select
                    id={id}
                    className={INPUT}
                    value={field.value}
                    onChange={(e) => actions.setField(f.key, e.target.value)}
                  >
                    {f.options!.map((o) => (
                      <option key={o}>{o}</option>
                    ))}
                  </select>
                )}
                {f.help && <p className="mt-1 text-xs text-mute">{f.help}</p>}
                <label className="mt-2 flex items-center gap-2 text-xs text-ink-soft">
                  <input
                    type="checkbox"
                    checked={field.verified}
                    disabled={!field.value.trim() || field.value === "Not yet decided" || field.value === "Not yet classified"}
                    onChange={(e) => actions.setVerified(f.key, e.target.checked)}
                  />
                  I have checked this against a source document or official CDSCO resource
                </label>
              </div>
            );
          })}
        </form>
      </Card>
      <p className="mt-3 text-xs text-mute">
        Saved automatically in this browser only (no account, no server storage). Editing a value
        clears its verified tick.
      </p>
    </>
  );
}
