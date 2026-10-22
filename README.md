# Evidentra

Regulatory intelligence for medical-device teams. One journey, three features: **upload documents → find evidence and inconsistencies → generate a CDSCO readiness brief.**

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
| `npm test` | Unit tests (Vitest): CSV safety, quote verification, evidence rules, consistency checks, report counts |
| `npm run typecheck` | TypeScript check |
| `npm run lint` | ESLint |
| `npm run build` then `npm start` | Production build and server |
| `npm run check:gemini` | Confirms your key can reach the configured Gemini model (prints no secrets) |

## Environment variables

| Name | Required | Purpose |
| --- | --- | --- |
| `GEMINI_API_KEY` | For AI features | Google Gemini API key. Read **only** in server code (`src/lib/gemini.ts`); never sent to the browser, never in API responses or logs. Do **not** prefix with `NEXT_PUBLIC_`. |
| `GEMINI_MODEL` | No | Defaults to `gemini-3.8-flash` (stable Flash model, checked against Google's model list in Oct 2026). |
| `EVIDENTRA_DATA_DIR` | No | Where uploads and results are stored. Default `.data/` locally, `/tmp/evidentra-data` on Vercel. |

`.env.local` and `.data/` are git-ignored. `.env.example` contains variable names only. Without a key the app still runs; AI buttons are disabled with an explanation.

## Demo script (about 3 minutes)

1. Open the site. The opening ("Complexity is the enemy. Evidence is the answer.") → **Analyse a dossier**.
2. **01 Dossier Intelligence** — drop PDFs (or **Try the synthetic sample**, clearly labelled *SYNTHETIC DEMO DATA*). Each file shows a real processing state; **View text** shows the extracted text page by page.
3. **Analyse dossier** — one button runs the real steps (list documents → Gemini reads and compares them → code checks values exactly → Gemini matches regulatory evidence). The inline scan shows only steps that are actually running, and stops with an honest error if a step fails.
4. **Extracted evidence** — every passage is a verified quote with its page; field names and values are labelled as AI suggestions.
5. **02 Anomaly Engine** — each inconsistency shows the two sides, the conflicting values highlighted inside the real quotes, documents and pages. **Mark as reviewed**.
6. **03 CDSCO Readiness Brief** — key findings, unresolved issues, next actions and verified regulatory references, each labelled as confirmed in text, AI suggestion, demo data, reviewed by you or needing human review. **Print / save PDF** or **Download CSV**.

## The three features

| Feature | Where | What it does |
| --- | --- | --- |
| Dossier Intelligence | `/#dossier` | PDF upload and validation, real text extraction, page-by-page text viewer, the single **Analyse dossier** action, extracted evidence with verified quotes and pages |
| Anomaly Engine | `/#anomalies` | Cross-document inconsistencies (exact code checks + AI semantic suggestions) with the conflicting values, quotations, documents and pages; mark as reviewed |
| CDSCO Readiness Brief | `/#report` | One concise report: key findings, unresolved issues, next actions, verified MDR 2017 references (applicability marked unresolved); print/PDF and CSV |

Everything is one page (`src/app/page.tsx`). The old routes (`/workspace`, `/documents`, `/evidence-matrix`, `/consistency-checks`, `/readiness-report`) redirect to the matching section.

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

In the Anomaly Engine a reviewer can **mark a finding as reviewed**. Reviews are saved in the browser per dossier and keyed by what the finding is (not by AI run), so they survive re-running the analysis; if the evidence changes afterwards the finding says so. Reviews are not shared between browsers or users yet.

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
- The print layout of the readiness brief has not been checked in detail.

## Project layout

```
src/app/page.tsx                     the whole experience (opening → 3 chapters → final call to action)
src/components/experience/           Signal (opening), Dossier, Anomalies, Brief, FinalCta, TopNav, Molecule, Reveal
src/components/AnalyzeAction.tsx     the single "Analyse dossier" action
src/components/IntelligenceScan.tsx  inline scan showing only real processing steps
src/app/api/                         documents, analyze, requirements/map, demo/load, health
src/lib/                             report builder, deterministic checks, CSV, stores
src/lib/server/                      PDF extraction, storage, Gemini calls, quote verification, demo loader
fixtures/                            fictional test PDFs (synthetic demo dossier, mismatch test, blank scan)
tests/                               Vitest unit tests
```
