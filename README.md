# Evidentra

AI-assisted regulatory documentation copilot for Indian medical-device manufacturers. It helps a regulatory or quality person spot **missing or inconsistent evidence** in a product's documents before a human regulatory review.

> **Safety note.** Evidentra is a document-review aid. It is not legal advice, does not certify compliance with the Medical Devices Rules, 2017, and does not file anything with CDSCO. The requirement list is an **unverified draft** (topics taken from CDSCO's public FAQ, no clause numbers asserted). Always confirm against official CDSCO sources.

## What works today

| Page | Status |
| --- | --- |
| Overview | Live stats from the current workspace; shows AI key status |
| Submission Workspace | Working form, auto-saved in your browser; every field is labelled *Unverified* until you tick it |
| Documents | Upload up to 5 PDFs (basic checks: extension, size, empty, `%PDF-` signature). Contents are **not** read yet |
| Evidence Matrix | Requirement topics vs. cited passages, Approve/Reject buttons, CSV export |
| Consistency Checks | Plain-code checks: model number, manufacturer and device name consistency; certificate expiry |
| Readiness Report | Summary for a human reviewer, CSV export, print to PDF |

The seeded **demo workspace is fictional** (a made-up pulse oximeter, company and certificate, with a planted model-number mismatch and an expired sample certificate). It is badged "Demo" everywhere. Uploaded files are badged "Your upload".

**Not built yet:** Gemini-based fact extraction and evidence suggestions. `src/lib/gemini.ts` and `POST /api/analyze` are placeholders; `/api/analyze` returns HTTP 501 and no findings.

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

`.env.local` is ignored by Git. Never commit a real key. `.env.example` holds the variable name only.

## Deploy to Vercel

1. Push this repo to GitHub.
2. In Vercel, **Add New → Project**, import the repo (framework is detected as Next.js).
3. Under **Settings → Environment Variables**, add `GEMINI_API_KEY`.
4. Deploy.

## Project layout

```
src/app/                 pages (one folder per dashboard page) and API routes
src/app/api/health       reports whether a key is configured (never returns the key)
src/app/api/analyze      placeholder for the AI step (501 for now)
src/components/          AppShell (sidebar) and small UI pieces
src/lib/demo-data.ts     the fictional demo workspace
src/lib/requirements.ts  draft requirement topics + source links
src/lib/checks.ts        deterministic consistency and expiry checks
src/lib/store.ts         browser-only state (localStorage), no database
src/lib/csv.ts           CSV export
src/lib/gemini.ts        server-only Gemini client helper
```

## Next steps

1. Extract text per page from uploaded PDFs on the server.
2. Call Gemini for structured facts (value + exact quote + page) and verify each quote exists on that page in code.
3. Ask Gemini to suggest evidence per requirement; humans approve or reject.
4. Verify each requirement topic against official CDSCO text and record who checked it.
