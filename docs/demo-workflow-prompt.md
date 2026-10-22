# Prompt: design the end-to-end demo workflow for Evidentra

Copy everything below the line into ChatGPT.

---

You are a senior solutions engineer, hackathon demo coach and product designer for B2B AI software. Help me design a complete, convincing **live demo workflow** for my product Evidentra. Right now judges see a polished website and assume it is "just a front end". I need the demo to make the **real backend pipeline visible and believable** — without faking anything.

## 1. What Evidentra is

Evidentra (https://evidentra-azure.vercel.app) is a regulatory-intelligence tool for Indian medical-device manufacturers. One journey, three features:

1. **Dossier Intelligence** — upload regulatory PDFs, extract their real text, trace evidence to the exact page.
2. **Anomaly Engine** — compare values across documents (device name, model number, manufacturer, intended use, specifications, revisions, validity dates) and flag inconsistencies with the exact quotes and pages. A reviewer marks findings as reviewed.
3. **CDSCO Readiness Brief** — one report with key findings, unresolved issues, next actions and verified regulatory references. It never claims compliance or approval.

It is a single scrolling page (opening → Dossier → Anomalies → Report → final call to action), dark cinematic design, light editorial report.

## 2. What actually happens behind the UI (all real, already built)

Tech: Next.js 16 (App Router) + TypeScript + Tailwind, deployed on Vercel; Google Gemini via the official `@google/genai` SDK, model `gemini-3.8-flash`; Zod validation; `unpdf` (pdf.js) for text extraction; Vitest (20 unit tests).

**Pipeline when the user clicks "Analyse dossier":**

| Step | What runs | Where |
| --- | --- | --- |
| 0. Upload | Each PDF is POSTed to `/api/documents`. Server checks extension, size ≤ 4 MB, empty file, and the `%PDF-` signature; rejects renamed/corrupt files with a plain message. | server |
| 1. Extract | `unpdf` extracts text **page by page**. Status per file: "Text extracted", "No readable text (needs OCR)" or "Could not be read". Stored privately (not in `public/`), keyed by a random document ID per workspace. | server |
| 2. Prepare | Client lists the readable documents (`GET /api/documents`). | client → server |
| 3. Read & compare (AI request 1) | `POST /api/analyze`: page-marked text (capped at 40k chars/doc, 150k total) is sent to Gemini with a strict JSON schema. The prompt treats PDF text as untrusted data (prompt-injection guard). Gemini returns facts, semantic inconsistencies and possible missing information, each with filename, page and a verbatim quote. Zod validates the reply; malformed output is retried once; 503 overload retried twice. | server → Gemini |
| 4. Quote verification (code) | Every quote is searched for in the actual extracted text. Result per quote: **verified**, **found on another page** (page corrected by code), **not found**, or **unknown file**. Unverified quotes are shown in red and never treated as evidence. Dates are only accepted if the date literally appears in the quote. | server |
| 5. Exact checks (code, no AI) | Deterministic comparison of verified facts: model number, device name, manufacturer name (across and within documents), intended-use wording, each specification by parameter, conflicting revisions in one document, validity dates vs today. | client |
| 6. Evidence matching (AI request 2) | `POST /api/requirements/map`: Gemini proposes, for each requirement, Found / Partial / Missing / Conflicting / Needs review with quotes. **Code caps the status**: Found/Partial need ≥ 1 verified quote, Conflicting needs ≥ 2, otherwise → Needs review. "Missing" is shown as "not found in uploaded documents" until a human confirms it. | server → Gemini |
| 7. Report | The brief is computed live from the stored results + human reviews (no hardcoded numbers). Export: print/PDF and CSV (RFC 4180, formula-injection safe). | client |

**Regulatory source:** 10 requirement items checked against the CDSCO-published Medical Devices Rules, 2017 text (as amended to 14 Oct 2022): Fourth Schedule Part II(ii)(a)(b)(c)(d)(f) and Appendix II sections 2.1, 3.0, 6.0, 7.2 and the "certificates within validity" note, with PDF page numbers. Applicability to a specific device class/pathway is shown as **unresolved** (needs human confirmation). Later amendments and the online portal checklist were not reviewed.

**Demo data:** a labelled *SYNTHETIC DEMO DATA* dossier of 4 fictional PDFs (device master file summary, instructions for use, risk management summary, QMS certificate) for a made-up pulse oximeter. It contains a planted model-number mismatch (AP-200A vs AP-2000A), a partial risk analysis ("residual risk evaluation: to be completed"), and no biocompatibility evidence. Its seed results are hand-written but every quote is re-verified against the PDFs on load. There is also a 2-page fictional test PDF (Nova Thermometer, model NT-100 on page 1 vs NT-110 on page 2), and a blank "scanned" PDF that triggers "needs OCR".

**Known constraints (must be handled honestly in the demo):**
- The Gemini key can hit its quota; the app then shows "The Gemini API key has used up its quota…" and invents nothing.
- On Vercel, uploads live in temporary serverless storage (`/tmp`), not shared between instances, so user uploads can disappear; the synthetic sample re-seeds itself. Running locally (`npm run build && npm start`) is the reliable option for live uploads.
- No user accounts; reviews are stored in the browser.
- AI runs take ~10–60 s each.

## 3. The problem I need you to solve

Judges think it's "just a front end" because:
- The UI hides the pipeline; results appear after a spinner.
- The sample dossier loads instantly, which looks pre-baked.
- They can't see the AI request, the verification step or the deterministic checks happening.
- There is no proof that findings come from the documents rather than from the UI code.

## 4. What I want from you

Design a demo workflow that **proves the system is real** in 5 minutes, then answer judges' technical questions in 3 minutes. Specifically:

1. **Demo narrative** — a minute-by-minute script (what I say, what I click, what the judge should notice). Open with the problem (manual dossier review, repeated CDSCO queries), then show the pipeline working, then the payoff (readiness brief).
2. **"Prove it's real" moments** — at least 5 concrete moments that show backend behaviour live, for example:
   - Upload a PDF the judges give me (or one I edit in front of them, e.g. change a model number in a Word doc → export PDF → upload) and show the new mismatch appear with the exact page.
   - Upload a renamed/corrupt file to show server validation.
   - Upload the blank scan to show "needs OCR" instead of fake success.
   - Show a quote marked "not found in the text" or "found on another page" to prove code verifies the AI.
   - Show the prompt-injection line in a fixture being ignored.
   - Show the quota/error path honestly if it happens.
3. **A visible "engine room" view** — propose a minimal UI addition (one panel or drawer, not a new feature area) that shows the real pipeline trace for the last run: steps, timings, AI requests made, token counts, number of quotes verified / not found, deterministic checks run, documents skipped and why. Specify exactly which existing data it can read (the analysis result already stores model, createdAt, token usage, per-document chars sent/truncation, skipped files, and per-quote verification status). Do not suggest anything that requires inventing data.
4. **Architecture slide** — a one-slide diagram description (boxes and arrows) of the pipeline above that I can draw in 10 minutes, with the "AI proposes, code verifies, human decides" message.
5. **Backup plan** — what to do if Gemini quota/Wi-Fi fails mid-demo: pre-run results, local server, recorded 60-second screen capture, and how to say it honestly ("this is the saved result of a real run at 14:02, here is its timestamp").
6. **Judge Q&A** — the 10 hardest technical and regulatory questions judges are likely to ask (hallucination, data privacy, why Gemini, how quotes are verified, what "verified requirement" means, scalability, CDSCO accuracy, false positives, cost per dossier, what's real vs demo), with short, honest answers based only on the facts above.
7. **Pre-demo checklist** — environment, key quota, test files, browser state, local fallback, timings.
8. **What not to say** — claims I must avoid (compliance, approval, "AI reads regulations", accuracy numbers we have not measured).

Constraints:
- Never fake results, timings, or AI output. Anything illustrative must be labelled synthetic demo data.
- Don't propose new product features beyond a small read-only pipeline/trace view.
- Keep it doable in one day by one developer.

Format: headings, numbered steps, short tables, and a final one-page "demo run sheet" I can print.
