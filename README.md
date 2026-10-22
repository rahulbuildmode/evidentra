# Evidentra

AI-assisted regulatory documentation copilot for Indian medical-device manufacturers. It helps a regulatory or quality person spot **missing or inconsistent evidence** in a product's documents before a human regulatory review.

> **Safety note.** Evidentra is a document-review aid. It is not legal advice, does not certify compliance with the Medical Devices Rules, 2017, and does not file anything with CDSCO. The requirement list is an **unverified draft** (topics taken from CDSCO's public FAQ, no clause numbers asserted). Always confirm against official CDSCO sources.

## What works today

| Page | Status |
| --- | --- |
| Overview | Live stats from the current workspace; shows AI key status |
| Submission Workspace | Working form, auto-saved in your browser; every field is labelled *Unverified* until you tick it |
| Documents | Upload up to 10 PDFs per workspace (max 4 MB each). Server checks type, size, empty files and the `%PDF-` signature, extracts text page by page, flags text-less PDFs as **needs OCR**, and records failed/damaged/password-protected PDFs with a clear error. "View text" shows the extracted text per PDF page |
| Evidence Matrix | Pick a requirement set, then "Map evidence with AI". Each requirement shows verification status and source, expected evidence, evidence status (Found / Partial / Missing / Conflicting / Needs review), source document, page and quotation, recommended next action and human review. Code verifies every quotation and downgrades any status its verified quotes don't support. CSV export |
| Consistency Checks | Compares device name, model, manufacturer, intended use, specifications, dates and revisions. **Exact comparisons are plain TypeScript** on quote-verified facts; **Gemini** proposes differences in meaning. Each finding shows the conflicting values, documents, pages, passages and a review status. Discrepancies are never labelled legal violations |
| Readiness Report | Summary for a human reviewer, CSV export, print to PDF |

The **demo workspace is fictional**. "Load demo dossier" (or *Reload demo* on the Workspace page) uploads four made-up PDFs from `fixtures/demo-dossier/` and a hand-written, clearly labelled demo seed. Every seed quotation is re-verified by code against the PDF text on each load. The dossier demonstrates, against the synthetic checklist:

- **Missing:** DEMO-06 biocompatibility evaluation (no such text anywhere in the dossier).
- **Partial:** DEMO-05 risk analysis (hazards listed; "Risk control measures and residual risk evaluation: to be completed before design freeze.").
- **Model-number mismatch:** DEMO-04 / consistency check ("Model number: AP-200A" in the device master file vs "Model: AP-2000A" in the IFU).

Running real Gemini mapping on the dossier (both requirement sets) reproduced these results with all quotations verified.

**Not built yet:** OCR for scanned PDFs, and AI-suggested evidence for the Evidence Matrix (it still shows demo-seeded suggestions only).

## Run it locally

Requires Node.js 20 or newer.

```bash
npm install
cp .env.example .env.local   # then open .env.local and paste your key after GEMINI_API_KEY=
npm run dev
```

Open http://localhost:3000.

Useful commands:

```bash
npm run lint     # style/problem checks
npm run build    # production build (also type-checks)
```

## Environment variables

| Name | Purpose |
| --- | --- |
| `GEMINI_API_KEY` | Google Gemini API key. Read **only on the server** (`src/lib/gemini.ts`). Never prefix it with `NEXT_PUBLIC_`. |
| `GEMINI_MODEL` | Optional. Defaults to `gemini-3.8-flash` (stable Flash model, checked against Google's model list in Oct 2026). |
| `EVIDENTRA_DATA_DIR` | Optional. Where uploads are stored. Default: `.data/` locally, `/tmp/evidentra-data` on Vercel. |

`.env.local` is ignored by Git. Never commit a real key. `.env.example` holds the variable name only.

## Requirement sets and regulatory sources

See [REGULATORY_SOURCES.md](REGULATORY_SOURCES.md). Two sets exist and are never mixed:

- **MDR 2017 — documents for a Class B/C/D manufacturing licence application (selected items).** Each item was checked against the CDSCO-published MDR 2017 text (as amended to 14 Oct 2022). Rows count as official only when the workspace says Class B/C/D and a manufacturing-licence pathway; otherwise they are labelled "reference only". Later amendments and the portal checklist were not reviewed.
- **Synthetic demo checklist (FICTIONAL).** For the demo dossier only.

## AI analysis (Gemini)

`POST /api/analyze` sends the extracted text of a workspace's readable uploads to Gemini with Google's official `@google/genai` SDK, asks for JSON matching a schema, and validates the reply with Zod.

- **Key safety:** `GEMINI_API_KEY` is read only in server code. It is never sent to the browser or included in API responses or logs. Check your key and model with `npm run check:gemini` (prints no secrets).
- **Traceability:** every fact and inconsistency carries filename, page and a quotation. Code then searches the real extracted text: *verified* (found on that page), *found on another page* (page corrected by code), *not found* or *unknown file*. Unverified items are shown in red with high uncertainty; nothing is hidden or silently fixed.
- **Untrusted input:** PDF text is wrapped as data, and the model is told never to follow instructions inside it. The fixture `fixtures/device_description_AP-200A.pdf` contains a deliberate prompt-injection line to test this.
- **Limits:** up to 40,000 characters per document and 150,000 in total (~40k tokens); output capped at 16,384 tokens; 90 s timeout; one run at a time per workspace.
- **Errors:** missing key, rejected key, quota/rate limit (429), overload (503, retried twice), timeouts, blocked content and malformed output (retried once) each return a plain message. A failed run never overwrites the previous result.
- **Not legal advice:** missing information means "not found in the uploaded documents". The model is told not to invent regulatory requirements; the requirement list remains a separate, unverified draft.
- **Storage:** the latest result per workspace is saved in `.data/analyses/` (same limits as uploads below). Accept/Reject decisions are saved in your browser.

Fictional test PDFs (with their HTML sources) are in `fixtures/`.

## Upload storage and its limits

Uploads go through `POST /api/documents`. Text is extracted on the server with [`unpdf`](https://github.com/unjs/unpdf) (a server-friendly build of Mozilla's pdf.js). Each document gets a random ID and is saved as two files: the original PDF and a JSON record (workspace ID, filename, status, page count, page-by-page text).

- **Where:** `.data/uploads/<workspaceId>/` in the project folder. This is git-ignored and **not** inside `public/`, so files are never served as static URLs. The API returns only metadata and text, never server file paths.
- **Privacy limit:** there are no user accounts. Anyone who can reach the running server and knows a workspace ID can list its documents. Use fictional or non-confidential PDFs.
- **Workspace link:** the workspace ID lives in your browser's localStorage. Clearing browser data loses the link (the files stay in `.data/` until you delete them). "Start blank workspace" creates a new ID with an empty folder.
- **Page numbers** are PDF page positions (1, 2, 3…), not the printed page labels.
- **Text quality:** layout, tables and reading order may be imperfect. Scanned pages produce no text and are flagged "needs OCR".

### On Vercel

Vercel functions have a read-only filesystem except `/tmp`, which is temporary and **not shared between server instances**. Uploads will appear to work and then disappear (or be missing on the next request). The 4 MB per-file limit also exists because Vercel rejects request bodies over ~4.5 MB. For a real deployment, replace `src/lib/server/document-store.ts` with durable private storage (for example Vercel Blob with private access, or S3) plus authentication.

## Deploy to Vercel

1. Push this repo to GitHub.
2. In Vercel, **Add New → Project**, import the repo (framework is detected as Next.js).
3. Under **Settings → Environment Variables**, add `GEMINI_API_KEY`.
4. Deploy.

## Project layout

```
src/app/                 pages (one folder per dashboard page) and API routes
src/app/api/health       reports whether a key is configured (never returns the key)
src/app/api/analyze      runs / returns Gemini analysis for a workspace
src/components/          AppShell (sidebar) and small UI pieces
src/lib/demo-data.ts     the fictional demo workspace
src/lib/requirements.ts  draft requirement topics + source links
src/lib/store.ts         browser-only state (localStorage), no database
src/lib/csv.ts           CSV export
src/lib/gemini.ts        server-only Gemini client helper
src/lib/server/          PDF extraction, private document/analysis store, Gemini prompt + call, quote verifier
src/lib/analysis.ts      Zod schema for model output + result types
src/lib/mapping.ts       evidence-mapping schema, statuses and the code rules that cap them
src/lib/checks.ts        deterministic cross-document comparisons
src/lib/server/gemini-map.ts   requirement-to-evidence mapping prompt
src/lib/server/demo-seed.ts    hand-written demo seed (quotes verified at load)
fixtures/demo-dossier/   fictional demo PDFs and their HTML sources
src/components/AiAnalysisPanel.tsx  AI results UI with review controls
src/lib/uploads.ts       shared upload types, limits and id checks
src/app/api/documents    upload/list (route.ts) and view/delete ([id]/route.ts)
```

## Next steps

1. Review MDR amendments after Oct 2022 and the portal checklist, then extend `REGULATORY_SOURCES.md` and the official set.
2. Store review decisions on the server (they live in the browser today).
3. Durable private storage and login before any real deployment.
