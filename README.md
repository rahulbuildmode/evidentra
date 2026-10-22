# Evidentra

AI-assisted pre-submission documentation review for Indian medical-device manufacturers. Upload a product's PDFs, and Evidentra extracts the text, maps it to requirement topics, checks the documents against each other, and produces a gap report for a **human** regulatory reviewer.

> **Not a compliance tool.** Evidentra does not give legal advice, does not certify compliance with the Medical Devices Rules, 2017, does not predict or guarantee CDSCO approval, and does not file anything. Every AI output is a suggestion until a person reviews it.

## Quick start (local)

Requires **Node.js 20+**.

```bash
npm install
cp .env.example .env.local      # then paste your Gemini key after GEMINI_API_KEY=
npm run dev
```

Open <http://localhost:3000>. The app opens on a **fictional demo workspace** that loads automatically.

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

## Demo script (about 5 minutes)

1. **Submission Workspace → Start blank workspace.** Fill in device name, manufacturer, model number, class and pathway (each field stays "Unverified" until you tick it).
2. **Documents → Upload PDFs.** Try `fixtures/tiny_text_test.pdf` (fictional; its two pages disagree on the model number) or the four PDFs in `fixtures/demo-dossier/`.
3. **View text** to inspect the extracted text per PDF page. Scanned or damaged PDFs are marked "needs OCR" / "Extraction failed", never as successful.
4. **Consistency Checks → Run AI analysis** (10–60 s). Every quotation is checked by code against the extracted text.
5. **Evidence Matrix → Map evidence with AI.** Each requirement shows status, source file, page and quotation.
6. Spot the **model-number mismatch** (exact code check + AI explanation) and any **missing** or **partial** evidence.
7. **Review a finding:** mark reviewed, accept/reject, change status, add a note, or dismiss as a false positive with a reason.
8. **Gap Report** — the full pre-submission report, built live from the data above.
9. **Export CSV** — evidence matrix, consistency findings, or the prioritised action list.

For a no-upload demo, use **Reload demo** on the Workspace page: four fictional PDFs plus a hand-written, clearly labelled seed that demonstrates one missing item (biocompatibility), one partial match (risk controls "to be completed") and one model-number mismatch (AP-200A vs AP-2000A). Seed quotations are re-verified against the PDF text on every load.

## What each page does

| Page | Purpose |
| --- | --- |
| Overview | Live counts and verification status |
| Submission Workspace | Device details; per-field "verified by me" ticks; start blank / reload demo |
| Documents | Upload up to 10 PDFs per workspace (≤ 4 MB each); validation; page-by-page text viewer |
| Evidence Matrix | Requirement set selector; AI mapping; status, source, page, quotation, next action, human review; CSV |
| Consistency Checks | Exact (code) comparisons + AI differences in meaning; dates and revisions; extracted facts; possible missing info; CSV |
| Gap Report | Pre-submission documentation gap report with counts, applicability questions, discrepancies, review queue, prioritised actions and a citation index; three CSVs; print to PDF |

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

Reviewers can mark reviewed, accept/reject AI suggestions, change status, add notes and dismiss false positives (reason required). Reviews are keyed by *what* an item is (not by AI run), so they survive re-running the AI; if the evidence changes afterwards the item shows **Changed since review**.

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
- Official requirement set covers 10 selected items for one scenario; amendments after Oct 2022 and the online portal checklist were not reviewed.
- Page numbers are PDF page positions, not printed page labels; text extraction can scramble tables.
- One AI run at a time per workspace per server process; Gemini can return 503 "high demand" (retried twice).
- Print layout of the Gap Report has not been checked in detail.

## Project layout

```
src/app/                      pages and API routes (api/documents, api/analyze, api/requirements/map, api/demo/load, api/health)
src/components/               AppShell, ReviewPanel, evidence/citation views, AI tables
src/lib/requirements.ts       requirement sets + applicability check
src/lib/analysis.ts           Zod schema for AI analysis output
src/lib/mapping.ts            evidence statuses and the code rules that cap them
src/lib/checks.ts             deterministic consistency comparisons
src/lib/report.ts             gap report builder (counts, questions, prioritised actions)
src/lib/review.ts, review-store.ts   review model (stable keys) and browser storage
src/lib/csv.ts                safe CSV writer and the three exports
src/lib/server/               PDF extraction, storage, Gemini calls, quote verifier, demo loader
fixtures/                     fictional test PDFs (demo dossier, mismatch test, blank scan)
tests/                        Vitest unit tests
docs/research/                secondary research report and market model
```
