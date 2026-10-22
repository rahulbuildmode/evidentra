# Prompt: simplify the Evidentra interface

Copy everything below the line into ChatGPT.

---

You are a senior product designer who specialises in B2B compliance and document-review tools. Help me make my web app **look and feel simple** without removing the safety features that make it trustworthy. Be concrete: name the exact element to change, what to replace it with, and why.

## 1. What the product is

**Evidentra** (live at https://evidentra-azure.vercel.app) is a hackathon prototype for regulatory-affairs and quality staff at small and mid-sized Indian medical-device manufacturers. A user uploads a product's PDFs (device description, instructions for use, risk summary, certificates). The app then:

1. Extracts the text page by page.
2. Uses Google Gemini to pull out facts (device name, model number, manufacturer, intended use, specifications, standards, dates, revisions) and to propose which document passages provide the evidence each requirement expects.
3. Uses plain code to check that every AI quotation really appears in the PDF text, and to compare values exactly across documents (for example, model "AP-200A" in one file vs "AP-2000A" in another).
4. Lets a human reviewer accept, reject, change status, add notes or dismiss each finding.
5. Produces a "pre-submission documentation gap report" and CSV exports.

It must never claim legal compliance or CDSCO approval. It distinguishes **official requirements** (checked against India's Medical Devices Rules, 2017 text), **synthetic demo items**, **AI suggestions**, a **hand-written demo seed**, **code checks** and **human-reviewed** items.

**Primary user:** a regulatory or QA person, often the only one in a small company, preparing one product's dossier. Not a developer. Busy, cautious, used to spreadsheets and Word. They want to know: *"What is wrong or missing in my documents, and what do I do next?"*

**Demo context:** shown live at a hackathon in about 5 minutes to judges who have never seen it.

## 2. Visual style today

- White/off-white background (#f7f8fa), navy text (#0b1f3a), teal accent (#0f766e), amber for warnings, red for problems, purple for "demo" items.
- Font: Geist (sans-serif). Small rounded "pill" badges are used for nearly every status.
- Layout: fixed left sidebar (about 256 px) with the logo "Evidentra." and the tagline "Regulatory documentation copilot", a purple "Demo workspace" pill, six navigation links, and a paragraph of disclaimer text under the links.
- An **amber banner on every page**: "Not a compliance tool. Requirements are labelled as official (checked against MDR 2017 text as amended to 14 Oct 2022, for a limited scenario) or synthetic demo data. AI output is a suggestion until a person reviews it. Confirm everything against current CDSCO sources."
- Most pages also show a **purple banner**: "FICTIONAL DEMO DOSSIER …".
- On a laptop-width window (about 800–1024 px of content), the wide tables scroll sideways and the right-hand columns (next action, review) are cut off until you scroll.

## 3. Page-by-page inventory (measured on the live demo workspace)

### 3.1 Overview (`/`)
- About 104 words. Heading "Overview" + one-line subtitle.
- Purple demo banner.
- 4 stat cards: "4 Documents", "3 / 7 Requirements not shown as found", "2 Exact-value discrepancies", "0 / 11 Items reviewed by a human".
- Card "Current workspace": Device, Manufacturer, Model, Classification, Pathway, plus an "Edit workspace →" link.
- Card "Verification status" with 4 rows and pills: requirement set ("Synthetic demo"), AI (Gemini) ("Key configured on server" / "No API key set"), Quotations ("Verified by code against PDF text"), Final decisions ("Human reviewer").
- There is no "start here" or next-step guidance.

### 3.2 Submission Workspace (`/workspace`)
- About 209 words. Buttons "Start blank workspace" and "Reload demo".
- A form with 6 fields: Device name, Manufacturer, Model number, Intended use (textarea), Classification (dropdown: Not yet classified, Class A–D), Regulatory pathway (dropdown: Not yet decided; Manufacturing licence — Class A/B (State Licensing Authority); Manufacturing licence — Class C/D (Central Licensing Authority); Import licence).
- Each field has an amber "Unverified" pill, helper text, and a checkbox: "I have checked this against a source document or official CDSCO resource". That is 6 pills and 6 checkboxes.
- Auto-saves in the browser. Editing a value clears its tick.

### 3.3 Documents (`/documents`)
- About 163 words. Buttons "Upload PDFs" and "Analyse with AI →" (a link to Consistency Checks).
- Purple demo banner explaining "Fictional demo" vs "Your upload".
- Table with columns File (name, size, character count), Origin (pill), Status (pill: "Text extracted", "No extractable text — needs OCR", "Extraction failed", plus error text), Pages, and two actions per row ("View text", "Remove").
- "View text" opens a panel below the table with the raw text, one block per PDF page.
- Error box for rejected files (for example "fake.pdf: this does not look like a real PDF"), with "Choose files again" / "Dismiss".
- A privacy paragraph at the bottom.

### 3.4 Evidence Matrix (`/evidence-matrix`)
- About **866 words**, page height about 2,500 px for only 7 requirements.
- Header buttons "Export CSV" and "Map evidence with AI".
- A card with a **requirement set dropdown** (two options: "MDR 2017 — documents for a Class B/C/D manufacturing licence application (selected items)" and "Synthetic demo checklist (FICTIONAL)"), a pill ("Checked against official text" or "Synthetic demo — not regulatory"), a long verification note, and an applicability box (green or amber) explaining whether the official set applies to the workspace's class and pathway.
- A provenance line, e.g. "Demo seed — hand-written evidence for the fictional dossier, not AI output. Documents: …", or "No evidence mapping for this requirement set yet …".
- **One 6-column table**, 1,080 px minimum width: Requirement (ID, title, description, source location, sometimes a "Rule text" excerpt, and a pill) | Expected evidence | Evidence status (pill: Found / Partial / Missing — not found in uploaded text / Conflicting / Needs review, plus provenance, an optional "Human: …" pill, "Proposed: …", a rationale and a code note) | Source document, page and quotation (one or more quotes, each with filename and a pill such as "Quote verified · p.1") | Recommended next action | Human review.
- The **Human review** cell is the same block repeated in every row: status pill ("Awaiting review" / "Reviewed"), a "Mark reviewed" button, optional Accept/Reject buttons, a "Status" dropdown, an "Add note" link and a "Dismiss as false positive" link (which opens a reason box). With 7 rows that is 7 buttons, 7 dropdowns and 14 links.
- Counts on the demo: 9× "Quote verified · p.1", 2× "Quote verified · p.2", 7× "Synthetic demo", 7× "Awaiting review".

### 3.5 Consistency Checks (`/consistency-checks`)
- About **1,290 words**, page height about **4,800 px**.
- Header button "Export findings CSV". Purple demo banner.
- Card "AI document analysis": explanation paragraph, "Run AI analysis" button with a live timer ("Analysing… 12s"), model name, status line (source, documents, tokens), and error box with "Try again".
- Six stacked sections:
  1. "Exact comparisons — deterministic code (2)": finding cards with severity pill (High/Medium/Low), source pill ("Code check"), title (e.g. "Model number differs across documents"), detail, conflicting values with quotes and file/page, plus the full review block.
  2. "Differences in meaning — AI (1)": a 5-column table (Field / finding, Explanation, Source and quotation, Uncertainty, Human review).
  3. "Document dates and revisions (7)": a 4-column table (Document, Field, Value, Passage).
  4. "Extracted facts (23)": a 5-column table with 23 rows, each with quote, verification pill, uncertainty pill ("low" / "medium" / "high"), "Stated confidence: high", and the full review block **including Accept/Reject**.
  5. "Potential missing information (1)": same 5-column table.
- Counts on the demo: **27× "Mark reviewed", 27× "Add note", 27× "Dismiss as false positive", 25× Accept, 25× Reject, 27× "Awaiting review"**, 24× "low" uncertainty pills.

### 3.6 Gap Report (`/readiness-report`)
- About **2,000 words**, page height about **6,700 px**. This is the page a judge or manager would look at.
- Header card: small caps label "PRE-SUBMISSION DOCUMENTATION GAP REPORT", device name as the title, manufacturer and model, a "Generated … · Requirement set … · Evidence: … · Consistency: …" line, four buttons ("Evidence CSV", "Findings CSV", "Actions CSV", "Print / PDF"), and a grey disclaimer box ("Not a compliance determination …").
- Purple demo banner.
- A "Key:" legend with 6 pills (Official requirement (verified text), Synthetic demo item, AI suggestion, Demo seed (hand-written), Code check, Reviewed (human)).
- **12 stat tiles** in two rows: Found, Partial, Missing, Conflicting, Needs review, Not assessed; Open discrepancies, Confirmed discrepancies, Resolved, Awaiting human review, Dismissed as false positive, Changed since review.
- **8 numbered sections:**
  1. Submission and device details (product card with 6 "Unverified"/"Verified" pills + documents card).
  2. Regulatory scenario and verification status.
  3. Evidence found, partial, missing and conflicting — one card per requirement grouped by status, each with 2–4 pills, expected evidence, rationale, quotes, next action and the full review block.
  4. Unresolved applicability questions (numbered list, e.g. "What is the device's confirmed risk class under MDR 2017?").
  5. Cross-document discrepancies (finding cards with review blocks).
  6. Findings awaiting human review (11 small cards).
  7. Prioritised recommended actions (table: Priority pill, Action, Supporting evidence, Review state).
  8. Supporting files, pages and quotations (table of 11 quotes with Verified/Not verified pills).
- A footer with "Clear all reviews for this workspace".
- Counts on the demo: 11× "Mark reviewed", 11× "Add note", 11× "Dismiss as false positive", 11× "Verified", 7× "High".

## 4. Why it feels complicated (my observations)

- **Badge overload:** almost every line has a pill, and pills mean different things (status, source, verification, uncertainty, review state, demo).
- **Repeated review controls:** the same 5-part review block appears on every row of every page (27 times on one page).
- **Three warning layers:** an amber global banner, a purple demo banner and a grey disclaimer, plus sidebar disclaimer text.
- **Jargon:** "deterministic code", "provenance", "verified text; scenario not", "Stated confidence", "uncertainty", "normalising", "MDR-4S-II(ii)(c)".
- **Duplicated information:** the model-number mismatch appears in the code check, in the AI section, in the Evidence Matrix (Conflicting), in the Gap Report discrepancies and in the action list.
- **Long pages:** Consistency Checks (~4,800 px) and Gap Report (~6,700 px) need a lot of scrolling; the most important answer ("what's wrong, what do I do") is not at the top.
- **Wide tables** scroll sideways on a laptop, hiding the "next action" and review columns.
- **No guided flow:** six equal-weight sidebar links; a new user doesn't know the order (workspace → upload → analyse → map → review → report).
- **Two AI buttons on two pages** ("Run AI analysis" on Consistency Checks, "Map evidence with AI" on Evidence Matrix) that users must run separately.

## 5. Constraints (must keep)

- Never imply legal compliance, certification or CDSCO approval; keep one clear, short disclaimer.
- Keep visible the difference between **official**, **synthetic demo**, **AI suggestion**, **code check** and **human-reviewed**, but it can be quieter (icons, tooltips, a single legend).
- Every finding must still show its **source file, page and exact quotation** (can be collapsed or shown on click).
- Human review must still allow: mark reviewed, accept/reject AI, change status, add note, dismiss with reason (can be moved into a side panel, a menu or a single "Review" button).
- "Missing" must still read as *not found in the uploaded documents*, not proof of absence.
- Must remain a single Next.js + Tailwind app; prefer changes I can make quickly (hours, not weeks).

## 6. What I want from you

1. **Diagnosis:** the top 10 sources of visual and cognitive complexity, ranked by impact, each with the exact element named.
2. **New information architecture:** propose a simpler navigation (fewer pages or a stepper/wizard) and the ideal order for the 5-minute demo. Say which pages to merge, rename or hide.
3. **Page-by-page redesign:** for each page above, describe the simplified layout (what is at the top, what is collapsed, what is removed, what moves to a drawer or tooltip), with short wireframe-style text sketches.
4. **Status and badge system:** one consistent, minimal system (e.g. at most 4 colours, icons and labels) covering evidence status, source type, quote verification and review state, with a single legend.
5. **Review UX:** a lighter pattern for the review controls (e.g. one "Review" button opening a side panel, bulk actions, keyboard shortcuts), keeping every capability listed in section 5.
6. **Plain-language copy:** rewrite headings, button labels, banners and the disclaimer in plain English for a non-technical regulatory user; give a before → after table.
7. **The "one-screen answer":** design the top of the Gap Report so that in 10 seconds a judge sees "X problems, Y missing items, here is what to do first".
8. **Quick wins vs bigger changes:** a prioritised list of 10 changes I can make in under 2 hours each, then 3–5 larger improvements.
9. **Risks:** anything in your proposal that could accidentally hide safety-critical information or make the tool look like it certifies compliance.

Format: headings, numbered lists and short tables. Be specific and practical; avoid generic UX advice.
