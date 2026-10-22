# Regulatory sources used by Evidentra

Evidentra does **not** give legal advice and does **not** certify compliance. This file records which official sources were read, what was verified, and what was not. Update it whenever the requirement library changes.

_Last reviewed: 22 October 2026. Library version 2.0 (`src/lib/regulatory/library.ts`)._

## Supported pathway (one only)

**Licence to manufacture for sale or distribution of a Class B, C or D medical device (not an in vitro diagnostic), domestic manufacturer, licence (not loan licence).**

- Class B → rule 20(1)–(2): application in **Form MD-3** to the State Licensing Authority "along with respective documents as specified in Part II of the Fourth Schedule" (PDF p.24).
- Class C/D → rule 21(1)–(2): application in **Form MD-7** to the Central Licensing Authority "along with documents as specified in clause (ii) of Part II of the Fourth Schedule" (PDF p.26).

**Not supported:** import licences, Class A, IVDs, loan licences, test licences, registration. For these the app leaves applicability unresolved; it never validates them.

## Primary sources (downloaded and text-checked)

| Source | Version / date | URL | SHA-256 of the file checked | Used for |
| --- | --- | --- | --- | --- |
| Medical Devices Rules, 2017 — CDSCO consolidated PDF | "As amended vide GSR 777(E) dt. 14-10-2022" (page 1) | https://cdsco.gov.in/opencms/resources/UploadCDSCOWeb/2022/m_device/mdr,%202017%20(1).pdf | `0839b29f…28c4d0` | Rules 20, 21; Fourth Schedule Part II (ii)(a)–(h); Appendix II 2.1, 3.0, 6.0, 7.2, closing note 3 |
| CDSCO checklist — fresh application in Form MD-7 (licence in Form MD-9, Class C & D) | Undated on the page; PDF created 4 Jun 2024 (file metadata) | https://cdsco.gov.in/opencms/export/sites/CDSCO_WEB/Pdf-documents/medical-device/7MD.pdf (linked from the CDSCO Medical Device & Diagnostics page) | `87b4dca9…dfe284f6` | Cross-references (items 4.0–10.0) and one checklist-only item (5.0 site ownership / tenancy) for Class C/D |
| CDSCO risk classification list ("Final Classification of MD.pdf") | PDF modified 4 Sep 2020 | https://cdsco.gov.in/opencms/resources/UploadCDSCOWeb/2018/UploadPublic_NoticesFiles/Final%20Classification%20of%20MD.pdf | `83583f87…2f09e9908` | Demo only: entry 97 "Pulse oximeter … (SpO2). C" (PDF p.9) |

The text of every cited page is stored in `data/regulatory/*.json`. `npm test` checks that every excerpt in the library appears on its cited page; `npm run verify:sources` re-downloads the three files and reports whether they changed.

## Requirement records

| ID | Reference | Page | Applicability rule (code) | How it is evaluated |
| --- | --- | --- | --- | --- |
| MDR-4S-II(ii)(a) | Constitution details · checklist 4.0 | 100 | Every application in the pathway | AI evidence matching + quote verification + keyword search |
| MDR-4S-II(ii)(b) | Site/Plant Master File · checklist 6.0 | 100 | Every application | same |
| MDR-4S-II(ii)(c) | Device Master File (Appendix II) · checklist 8.0 | 100 | Non-IVD | same |
| MDR-4S-II(ii)(d) | Essential Principles checklist · checklist 8.8 | 100 | Every application | same |
| MDR-4S-II(ii)(e) | Test licence "if any" · checklist 10.0 | 100 | Only if the profile says a test licence was obtained; "No" → not applicable; unknown → unresolved | same |
| MDR-4S-II(ii)(f) | Fifth Schedule undertaking · checklist 7.1 | 100 | Every application | same |
| MDR-4S-II(ii)(g) | Documents in clause (b) of paragraph (i) | 100 | **Always unresolved** — clause (b) of paragraph (i) is headed "In case of application for import licence"; whether (ii)(g) adds anything for a domestic manufacturer needs a regulatory specialist | Human only |
| MDR-4S-II(ii)(h) | IVD performance evaluation | 100 | IVD only → not applicable for non-IVD | — |
| CDSCO-MD7-5.0 | Checklist item 5.0, site ownership / tenancy | checklist p.1 | Class C/D only; Class B → unresolved (no Form MD-3 checklist verified) | evidence + keyword |
| MDR-4S-AppII-2.1 | DMF general description · checklist 8.2 | 106 | Non-IVD | evidence + exact comparison of model number, device name and manufacturer across documents |
| MDR-4S-AppII-3.0 | DMF labelling · checklist 8.6 | 107 | Non-IVD | evidence + exact comparison of model number |
| MDR-4S-AppII-6.0 | DMF risk analysis and control summary · checklist 8.9 | 109 | Non-IVD | evidence + keyword |
| MDR-4S-AppII-7.2 | DMF biocompatibility · checklist 8.11 | 111 | Non-IVD | evidence + keyword |
| MDR-4S-AppII-note3 | Certificates within validity | 114 | Every application | quote-verified "valid until" dates compared with today (code) |

## Amendments after 14 Oct 2022

From CDSCO's Gazette Notifications page (https://www.cdsco.gov.in/opencms/opencms/en/Notifications/Gazette-Notifications; newest entries read, the tail of the list was not), the following notifications were opened:

- **Final:** GSR 409(E) 2 Jun 2023 (rules 3, 18, 19: State testing labs); GSR 165(E) 2 Mar 2026 (inspector/analyst qualifications); GSR 743(E) 14 Aug 2026 (Ninth Schedule testing fees, rules 19(3), 44, 69); GSR 744(E) 14 Aug 2026 (rules 19H, 19J, 19, 63). None amends rule 20, rule 21, Fourth Schedule Part II or Appendix II.
- **Drafts (not in force):** GSR 883(E) Dec 2025 (retention fees, forms MD-5/6/9/10); **GSR 515(E) 23 Jun 2026 would change timelines in rules 20(5)–(6) and 21(4)** — not the documents required.
- **Not opened:** GSR 269(E) and 270(E) (drafts, 10 Apr 2026). egazette.gov.in was not searched.

This review was done by an AI research assistant reading the official PDFs; a qualified person should re-check it before relying on it.

## Not verified (known gaps)

- The online portal (cdscomdonline.gov.in) checklist, and any official checklist for **Form MD-3** (Class B).
- The newer **merged risk classification list (1 Jan 2025)** — only the 2020 list was checked for the demo device's category.
- Appendix I (Site/Plant Master File) contents and most Appendix II sections are not modelled item by item.
- Interpretation of clause (ii)(g).

## Synthetic demo

The demo dossier (`fixtures/demo-dossier/`) and its device profile are **fictional**. The demo profile's Class C comes from the official list entry for the category "pulse oximeter" but is left **unconfirmed**, because the device is fictional. The old synthetic checklist (`synthetic-demo-checklist`) is no longer used by the app's workflow.
