# Regulatory sources used by Evidentra

Evidentra does **not** give legal advice and does **not** certify compliance. This file records which official sources were read, what was verified, and what was not. Update it whenever the requirement library changes.

_Last reviewed: 22 October 2026._

## Primary sources read

| Source | Publisher | Version / date seen | URL | Used for |
| --- | --- | --- | --- | --- |
| Medical Devices Rules, 2017 (full text PDF) | CDSCO, Ministry of Health & Family Welfare | GSR 78(E) dt. 31-1-2017, "as amended vide GSR 777(E) dt. 14-10-2022" (stated on page 1) | https://cdsco.gov.in/opencms/resources/UploadCDSCOWeb/2022/m_device/mdr,%202017%20(1).pdf | Requirement set `cdsco-mdr2017-mfg-bcd` |
| Medical Devices Rules, 2017 — notifications list | CDSCO | Page lists 34 entries; latest listed 2 Jun 2023 (G.S.R. 409(E)) | https://cdsco.gov.in/opencms/opencms/en/Acts-and-rules/Medical-Devices-Rules | Checking which amendments exist |
| Medical Device & Diagnostics division page | CDSCO | Undated; contains 2021 items | https://cdsco.gov.in/opencms/opencms/en/Medical-Device-Diagnostics/Medical-Device-Diagnostics/ | Forms and SUGAM pathways (context only) |
| FAQ on Medical Devices Rules, 2017 (Doc CDSCO/FAQ/MD/01/2024) | CDSCO | 2024 | https://cdsco.gov.in/opencms/export/sites/CDSCO_WEB/Pdf-documents/MDfAq24.pdf | Context only. The FAQ itself says it is not for legal use |

## What was verified

Requirement set **`cdsco-mdr2017-mfg-bcd`** (`src/lib/requirements.ts`). Each item was matched to text in the MDR 2017 PDF above:

| ID | Rule text location (PDF page) |
| --- | --- |
| MDR-4S-II(ii)(a) Constitution details | Fourth Schedule, Part II, clause (ii)(a), p.100 |
| MDR-4S-II(ii)(b) Site/Plant Master File | Fourth Schedule, Part II, clause (ii)(b), p.100 |
| MDR-4S-II(ii)(c) Device Master File | Fourth Schedule, Part II, clause (ii)(c), p.100 |
| MDR-4S-II(ii)(d) Essential Principles checklist | Fourth Schedule, Part II, clause (ii)(d), p.100 |
| MDR-4S-II(ii)(f) Fifth Schedule undertaking | Fourth Schedule, Part II, clause (ii)(f), p.100 |
| MDR-4S-AppII-2.1 DMF general description | Fourth Schedule, Appendix II, 2.1(a), p.106 |
| MDR-4S-AppII-3.0 DMF labelling | Fourth Schedule, Appendix II, 3.0, p.107 |
| MDR-4S-AppII-6.0 DMF risk analysis and control summary | Fourth Schedule, Appendix II, 6.0, p.109 |
| MDR-4S-AppII-7.2 DMF biocompatibility | Fourth Schedule, Appendix II, 7.2, p.111 |
| MDR-4S-AppII-note3 Certificates within validity | Fourth Schedule, Appendix II, closing note 3, p.114 |

**Applicability verified for:** a *domestic manufacturer* applying for a licence to manufacture for sale or distribution of a *Class B, C or D* device. Basis: rule 20 (Class A/B, Form MD-3, "documents as specified in Part II of the Fourth Schedule", p.23) and rule 21 (Class C/D, Form MD-7, "documents as specified in clause (ii) of Part II of the Fourth Schedule", p.25); clause (ii) is headed "Documents to be submitted with the application for grant of licence to manufacture or import Class B, Class C or Class D medical device" (p.99).

The app shows these rows as official **only** when the workspace says Class B/C/D and a manufacturing-licence pathway. Otherwise they are labelled "reference only".

## Not verified (known gaps)

- **Amendments after 14 Oct 2022** (e.g. the 2023 notifications on CDSCO's list, the Oct 2025 classification directive and the June 2026 draft timelines reported in the press) were **not** reviewed against these items.
- The **online portal (SUGAM / cdscomdonline) checklist** may require more documents; it was not accessed.
- Only a **selection** of Fourth Schedule items is included (e.g. test licence "if any", Appendix II sections 1, 4, 5, 7.1, 7.3–7.10 are not modelled).
- **Not checked for:** Class A, import licences, in vitro diagnostic devices, or loan licences.
- Item wording in the app is a summary; the short "Rule text" excerpts are from the PDF's extracted text.

## Synthetic demo checklist

Requirement set **`synthetic-demo-checklist`** (DEMO-01 … DEMO-07) is **fictional**. It exists only to demonstrate the workflow with the fictional dossier in `fixtures/demo-dossier/` and must never be presented as regulatory.
