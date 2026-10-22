// Re-downloads the official CDSCO files behind the requirements library and checks they are the
// same files the stored page snapshots (data/regulatory/*.json) were taken from.
// Usage: node scripts/verify-regulatory-sources.mjs
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const dir = path.join(process.cwd(), "data", "regulatory");
let changed = 0;
for (const f of readdirSync(dir).filter((x) => x.endsWith(".json"))) {
  const snap = JSON.parse(readFileSync(path.join(dir, f), "utf8"));
  try {
    const res = await fetch(snap.url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const sha = createHash("sha256").update(Buffer.from(await res.arrayBuffer())).digest("hex");
    const same = sha === snap.sha256;
    if (!same) changed++;
    console.log(`${same ? "UNCHANGED" : "CHANGED — re-review the library"}  ${f}  ${snap.url}`);
  } catch (e) {
    changed++;
    console.log(`UNREACHABLE (${e.message})  ${f}  ${snap.url}`);
  }
}
process.exitCode = changed ? 1 : 0;
