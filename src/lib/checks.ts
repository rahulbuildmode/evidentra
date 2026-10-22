import type { AppState, Fact, Finding } from "./types";

/** Uppercase and strip everything except letters and digits, so "AP-200A" equals "ap 200a". */
export function normalizeIdentifier(s: string): string {
  return s.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** Company names: also ignore punctuation and the common "Pvt Ltd" style suffix noise. */
export function normalizeName(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

const cite = (f: Fact) => ({ filename: f.filename, page: f.page, quote: f.quote });

function consistency(
  facts: Fact[],
  field: Fact["field"],
  label: string,
  normalize: (s: string) => string,
): Finding[] {
  const group = facts.filter((f) => f.field === field);
  if (group.length < 2) return [];
  const distinct = new Map<string, Fact[]>();
  for (const f of group) {
    const key = normalize(f.value);
    distinct.set(key, [...(distinct.get(key) ?? []), f]);
  }
  if (distinct.size > 1) {
    const values = [...new Set(group.map((f) => f.value))];
    return [
      {
        id: `c-${field}-mismatch`,
        check: label,
        severity: "fail",
        title: `${label} differs across documents`,
        detail: `Found ${values.length} different values: ${values.join(" vs ")}. A human should decide which is correct.`,
        citations: group.map(cite),
      },
    ];
  }
  const rawValues = new Set(group.map((f) => f.value));
  if (rawValues.size > 1) {
    return [
      {
        id: `c-${field}-format`,
        check: label,
        severity: "info",
        title: `${label} written differently but matches after normalising`,
        detail: `Values: ${[...rawValues].join(" / ")}. Consider using one consistent spelling.`,
        citations: group.map(cite),
      },
    ];
  }
  return [];
}

export function todayISO(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function daysBetween(fromISO: string, toISO: string): number {
  const a = Date.parse(`${fromISO}T00:00:00Z`);
  const b = Date.parse(`${toISO}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}

export function expiryFindings(facts: Fact[], today: string): Finding[] {
  const out: Finding[] = [];
  for (const f of facts.filter((x) => x.field === "certificate_expiry_date")) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(f.value) || Number.isNaN(Date.parse(f.value))) {
      out.push({
        id: `c-expiry-unreadable-${f.id}`,
        check: "Certificate validity",
        severity: "warn",
        title: "Could not read the certificate date",
        detail: `The value "${f.value}" is not a valid YYYY-MM-DD date, so no expiry check was made.`,
        citations: [cite(f)],
      });
      continue;
    }
    const days = daysBetween(today, f.value);
    if (days < 0) {
      out.push({
        id: `c-expiry-${f.id}`,
        check: "Certificate validity",
        severity: "fail",
        title: "Certificate validity date has passed",
        detail: `The document states validity until ${f.value}, which is ${Math.abs(days)} days before ${today}.`,
        citations: [cite(f)],
      });
    } else if (days <= 90) {
      out.push({
        id: `c-expiry-soon-${f.id}`,
        check: "Certificate validity",
        severity: "warn",
        title: "Certificate validity ends within 90 days",
        detail: `The document states validity until ${f.value} (${days} days from ${today}).`,
        citations: [cite(f)],
      });
    }
  }
  return out;
}

function workspaceVsDocuments(state: AppState): Finding[] {
  const entered = state.workspace.modelNumber.value.trim();
  const models = state.facts.filter((f) => f.field === "model_number");
  if (!entered || models.length === 0) return [];
  const key = normalizeIdentifier(entered);
  const off = models.filter((f) => normalizeIdentifier(f.value) !== key);
  if (off.length === 0) return [];
  return [
    {
      id: "c-workspace-model",
      check: "Workspace vs documents",
      severity: "fail",
      title: "Workspace model number does not match some documents",
      detail: `Workspace says "${entered}", but ${off.length} document(s) show a different model number.`,
      citations: off.map(cite),
    },
  ];
}

/** `today` is null until the browser clock is known; date checks are skipped in that case. */
export function runChecks(state: AppState, today: string | null): Finding[] {
  const f = state.facts;
  return [
    ...consistency(f, "model_number", "Model number", normalizeIdentifier),
    ...consistency(f, "manufacturer_name", "Manufacturer name", normalizeName),
    ...consistency(f, "device_name", "Device name", normalizeName),
    ...(today ? expiryFindings(f, today) : []),
    ...workspaceVsDocuments(state),
  ];
}

/**
 * Plain-code cross-check of AI-extracted facts whose quotes were verified in the PDF text.
 * Only identifiers and names are compared; free text (addresses, specs) is left to the reviewer.
 */
export function checkVerifiedAiFacts(facts: Fact[]): Finding[] {
  return [
    ...consistency(facts, "model_number", "Model number", normalizeIdentifier),
    ...consistency(facts, "device_name", "Device name", normalizeName),
  ].map((f) => ({ ...f, id: `ai-${f.id}` }));
}
