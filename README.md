# Evidentra

Regulatory intelligence for medical-device teams. One journey, three chapters: **upload documents → confirm device and pathway → validate CDSCO requirements → inspect evidence → readiness brief.**

Architecture: **browser → Next.js API routes → services (PDF extraction, Gemini, storage) → server-side verification (quotes, deterministic checks, CDSCO applicability and validation) and report preparation → browser shows the server's results.** Nothing in the brief is pre-written in the frontend.

> **Not a compliance tool.** Evidentra does not give legal advice, does not certify compliance with the Medical Devices Rules, 2017, does not predict or guarantee CDSCO approval, and does not file anything. Every AI output is a suggestion until a person reviews it.

## Quick start (local)

Requires **Node.js 20+**.

```bash
npm install
cp .env.example .env.local      # then paste your Gemini key after GEMINI_API_KEY=
npm run dev
```

Open <http://localhost:3000>. The app opens on your own empty dossier; **Try the synthetic sample** loads the fictional demo dossier.

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server on port 3000 |
| `npm test` | Unit tests (Vitest): CSV safety, quote verification, evidence rules, consistency checks, report counts, run pipeline (Gemini stubbed), event de-duplication, run isolation |
| `npm run typecheck` | TypeScript check |
| `npm run lint` | ESLint |
| `npm run build` then `npm start` | Production build and server |
| `npm run verify:sources` | Re-downloads the official CDSCO files behind the requirements library and reports whether they changed |
| `npm run check:gemini` | Confirms your key can reach the configured Gemini model (prints no secrets) |

## Environment variables

| Name | Required | Purpose |
| --- | --- | --- |
| `GEMINI_API_KEY` | For AI features | Google Gemini API key. Read **only** in server code (`src/lib/gemini.ts`); never sent to the browser, never in API responses or logs. Do **not** prefix with `NEXT_PUBLIC_`. |
| `GEMINI_MODEL` | No | Defaults to `gemini-3.8-flash` (stable Flash model, checked against Google's model list in Oct 2026). |
| `GEMINI_FALLBACK_MODELS` | No | Comma-separated models tried in order, each once, **only** when a model's daily quota is used up (e.g. `gemini-3.5-flash-lite,gemini-flash-lite-latest`). Each switch is recorded in the Engine Room. Per-minute limits are waited out instead; overloads are retried on the same model. |
| `EVIDENTRA_DATA_DIR` | No | Local folder for uploads and results (default `.data/`). |
| `BLOB_READ_WRITE_TOKEN` | On Vercel | Set automatically when a **private** Vercel Blob store is connected to the project. Then all uploads, results, profiles and runs are stored there, shared by every serverless instance. Without it, files go to the local folder (on Vercel: `/tmp`, which is per-instance and temporary). |

`.env.local` and `.data/` are git-ignored. `.env.example` contains variable names only. Without a key the app still runs; AI buttons are disabled with an explanation.

## Demo script (about 3 minutes)

*Every dossier is a case. Every inconsistency is a lead. Every finding must have evidence.* One compact workspace, three stages (the stage is in the URL hash):

1. **01 Case file** (`/#dossier`) — choose a mission: *Analyse a dossier* (new, empty case) or *Explore sample dossier* (labelled SYNTHETIC DEMO DATA). Evidence intake shows each PDF's real extraction status; confirm the device and pathway; *Scan* runs the real pipeline with a step timeline driven by server events. Mission task cards below show what has genuinely been done.
2. **02 Investigation board** (`/#findings`) — leads in three lanes: *Conflicts · verified by code*, *Leads · AI proposals* (or demo seed) and *Possible gaps*. Select a lead to see the competing values, the verified quotations, the CDSCO requirements it affects and its next action; *Inspect source pages* opens the extracted page with the quote highlighted; *Mark as reviewed* records your decision.
3. **03 Case summary** (`/#readiness`) — reviewed and unresolved leads, every CDSCO requirement check with its official source, applicability and evidence, next actions, unresolved items; print/PDF and CSV.

**Case progress** (top right) counts only real actions — evidence extracted, scan run, a verified quotation opened, leads and requirement checks reviewed, summary exported — and shows achievements earned for them. There are no points or scores, and finishing a case does not mean the device is compliant.

For a full case, upload the 9 PDFs in `fixtures/full-dossier/`.

## CDSCO validation (one pathway)

See **[REGULATORY_SOURCES.md](REGULATORY_SOURCES.md)** for sources, the 14 requirement records and what was not verified.

1. **Device and pathway** (Dossier chapter, `PUT /api/profile`): device, intended use, manufacturer, category, risk class (+ "confirmed against the official classification"), manufacture/import, IVD, licence/loan licence, test licence. Unknown is allowed.
2. **Pathway decision (code):** in scope only for a domestic manufacturing licence for a Class B/C/D non-IVD device (Form MD-3 for Class B, MD-7 for C/D). Anything unknown → unresolved; import/Class A/IVD/loan licence → not supported.
3. **Per requirement (code, `src/lib/regulatory/validate.ts`):** applicability (applicable / not applicable with a recorded rationale / unresolved), evidence (AI-proposed quotations checked against the text, code keyword locations, exact checks), status:
   *Evidence found · Potential gap · Conflict detected · Needs human review · Not applicable · Validated against source* — never "compliant".
4. **Report (`GET /api/validation`):** prepared on the server from stored text, the saved analysis and mapping, and the profile. Each run also records a "CDSCO requirement validation" step and saves the report. The Readiness Brief shows sections A–E (scope, per-requirement results, priority actions, unresolved items, references) and exports the same rows as CSV.

AI request 2 (evidence matching) maps against these official requirement ids. Without it (e.g. no quota), the validator uses only code keyword search and exact checks, and says so.

## Run trace (Engine Room)

| Endpoint | What it does |
| --- | --- |
| `POST /api/runs` `{ workspaceId, requirementSetId }` | Runs the pipeline and streams Server-Sent Events (`id:` = sequence number, `data:` = `{ seq, runId, type, at, step, message, data }`). Events carry metadata only, never document text. |
| `GET /api/runs?workspaceId=` | This workspace's saved runs, newest first |
| `GET /api/runs/<runId>?workspaceId=` | One saved run: steps, events, documents, AI requests (with the model's original proposal), quotation checks, deterministic checks, findings. Only readable from its own workspace. |
| `POST /api/proof/verify` | Runs the real quote verifier on a test quotation (read-only) |
| `POST /api/proof/injection` | Sends the uploaded injection fixture through the real analysis request and reports what the output contains |
| `GET /api/proof/fixture?name=blank\|injection` | The fictional test PDFs, uploaded by the browser through the normal upload endpoint |

- Wall-clock timestamps for chronology, a monotonic clock (`performance.now()`) for durations, measured on the server. Extraction time is recorded at upload; older uploads say "Not recorded".
- Runs are saved to `runs/<workspace>/<runId>.json` next to the uploads, after every step, so a browser that loses the stream re-reads progress (events are de-duplicated by sequence number).
- **Replay last real run** plays a saved run's own events at their recorded offsets, labelled *SAVED RUN — NOT LIVE* with its original timestamp. Nothing is re-run.
- Loading the synthetic sample records a *demo-seed* run: extraction, verification and checks really run; the AI steps are recorded as skipped.

## How results are kept honest

- **Quote verification (code):** every AI citation is searched for in the extracted text — *verified*, *found on another page* (page corrected by code), *not found* or *unknown file*. Unverified citations are shown in red.
- **Status caps (code):** "Found"/"Partial" need ≥ 1 verified quotation; "Conflicting" needs ≥ 2. Otherwise the status becomes "Needs review". "Missing" always means *not found in the uploaded text*, not proof of absence.
- **Exact comparisons (code)** only use quote-verified facts. Gemini handles semantic comparison. Discrepancies are never called legal violations.
- **Provenance labels** separate official requirements, synthetic demo items, AI suggestions, the demo seed, code checks and human-reviewed items.
- **Untrusted input:** PDF text is wrapped as data; the model is told never to follow instructions inside it (a fixture contains a prompt-injection line to test this).

## Requirement sets

See **[REGULATORY_SOURCES.md](REGULATORY_SOURCES.md)**.

- **MDR 2017 — Class B/C/D manufacturing licence documents (10 selected items)**, checked against the CDSCO-published MDR 2017 text *as amended to 14 Oct 2022*. Shown as applicable only when the workspace says Class B/C/D and a manufacturing-licence pathway.
- **Synthetic demo checklist (FICTIONAL)** — for the demo dossier only.

## Human review

In 02 Findings a reviewer can **mark a finding as reviewed**. Reviews are saved in the browser per dossier and keyed by what the finding is (not by AI run), so they survive re-running the analysis; if the evidence changes afterwards the finding says so. Reviews are not shared between browsers or users yet.

## CSV exports

RFC 4180 quoting (quotes doubled; commas and newlines kept inside quoted fields), CRLF rows, UTF-8 BOM. Cells starting with `=`, `+`, `-`, `@` (after optional spaces), tab or carriage return get a leading `'` to prevent spreadsheet formula injection.

## Security notes

- API key: server-only; checked that it does not appear in tracked files, git history or the built client/server bundles.
- Uploads: extension, size (4 MB), empty-file and `%PDF-` signature checks on the server; password-protected/damaged PDFs fail safely. File names are sanitised; IDs are restricted to `[a-z0-9-]` so they cannot escape the storage folder.
- Privacy: files live outside `public/` and are never served by URL; APIs return text and metadata, never server paths. **There is no authentication** — anyone who can reach the server and knows a workspace ID can read that workspace. Use fictional or non-confidential documents.

## Storage, serverless limits and what production needs

The prototype stores everything on the server's local disk (`.data/`): uploaded PDFs, extracted text, the latest AI analysis and evidence mapping per workspace. Human reviews are stored in the **browser** (localStorage) per workspace.

On **Vercel** (serverless) this is not persistent:

- Only `/tmp` is writable; it is **wiped** when an instance stops and is **not shared** between instances. An upload can succeed and then be missing on the next request, and AI results can disappear.
- The fictional demo workspace re-seeds itself on a fresh instance, so the demo keeps working — but user uploads and AI runs do not survive.
- Request bodies over ~4.5 MB are rejected (hence the 4 MB per-file limit).
- Long AI calls need the function duration allowed by your Vercel plan (`maxDuration = 120` is set on AI routes).

For persistent production use you still need:

1. **Private object storage** for PDFs (e.g. Vercel Blob with private access, Amazon S3, or Google Cloud Storage) — replace `src/lib/server/document-store.ts`.
2. **A database** for extracted text, analyses, mappings and reviews (e.g. Postgres via Neon/Supabase) — replace `src/lib/server/analysis-store.ts` and move reviews from `src/lib/review-store.ts` to the server.
3. **Authentication and per-organisation access control**, plus audit logging of review decisions.

**For a live hackathon demo, run locally** (`npm run dev` or `npm run build && npm start`) for reliable uploads.

## Gemini on Vercel

`vercel.json` runs the server functions in `bom1` (Mumbai), the same region as the private Blob store, so storage reads stay in-region.

`GET /api/health` shows whether `GEMINI_API_KEY` is set for the current deployment environment (never the key); `GET /api/health?probe=1` also checks that the key is accepted (model metadata, no generation, so it does not test generation quota).

The key is currently set for **Production only**. Preview deployments therefore report "not set". To fix:

```bash
npx vercel env add GEMINI_API_KEY preview
```

(paste the key when prompted; repeat with `development` if needed), then redeploy. A key that is set but out of quota shows "The Gemini API key has used up its quota" — fix that in Google AI Studio (plan/billing), not in Vercel.

## Deploying

### GitHub

```bash
gh repo create <your-account>/evidentra --private --source . --push
```

(or create an empty repository on github.com and `git remote add origin … && git push -u origin main`). `.env.local` and `.data/` are ignored and will not be pushed.

### Vercel

1. Vercel → **Add New → Project** → import the GitHub repository (framework: Next.js; defaults are fine).
2. **Settings → Environment Variables:** add `GEMINI_API_KEY` (and optionally `GEMINI_MODEL`).
3. Deploy. Read the storage limits above before relying on uploads.

## Known limitations

- No OCR: scanned PDFs are flagged, not read.
- Reviews are per browser; no reviewer identity or shared review state.
- Device class and pathway are not entered in the app, so the applicability of regulatory references is always shown as unresolved.
- Official requirement set covers 10 selected items for one scenario; amendments after Oct 2022 and the online portal checklist were not reviewed.
- Page numbers are PDF page positions, not printed page labels; text extraction can scramble tables.
- One AI run at a time per workspace per server process; Gemini can return 503 "high demand" (retried twice).
- Saved runs live on the same local/`/tmp` storage as uploads: on Vercel they can disappear and a reconnecting browser may reach an instance that does not have them. If the browser disconnects mid-run the server keeps going and saves the run, but on Vercel a function can be stopped once its response ends.
- The prompt-injection test checks the output with a keyword scan (compliant / approved); a person should read the output. One run is not proof that injection is solved.
- The "Prove it's real" quote test (D) is isolated, so it does not appear in the Engine Room counts.
- The print layout of the readiness brief has not been checked in detail.

## Project layout

```
src/app/page.tsx                     the workspace (01 Dossier → 02 Findings → 03 CDSCO readiness)
src/components/workspace/            Workspace shell + steps: DossierStep, FindingsStep, ReadinessStep, RunProgress
src/components/AnalyzeAction.tsx     the single "Analyse dossier" action (starts a streamed run)
src/components/experience/EngineRoom.tsx, ProveItsReal.tsx, DevicePathway.tsx   run trace, backend tests, device/pathway form
src/components/EvidenceInspector.tsx raw-evidence side panel
src/lib/run.ts, run-view.ts, run-client.ts                                 run types, event reducer, client stream/replay
src/app/api/                         documents, runs, proof, analyze, requirements/map, demo/load, health
src/lib/                             report builder, deterministic checks, CSV, stores
src/lib/server/                      PDF extraction, storage, Gemini calls, quote verification, demo loader, run recorder + pipeline
fixtures/                            fictional test PDFs (synthetic demo dossier, mismatch test, blank scan)
tests/                               Vitest unit tests
```
