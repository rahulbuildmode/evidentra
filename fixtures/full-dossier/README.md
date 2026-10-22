# Full test dossier — OxiTrack OT-500 (FICTIONAL)

A complete but **fictional** licence dossier for a Class C fingertip pulse oximeter made by "Example Biomedical Pvt Ltd". Real CDSCO dossiers are confidential and not public; this one follows the structure of CDSCO's official checklist for Form MD-7 so that Evidentra has something realistic to validate. Every page says it is fictional.

| File | Checklist item it represents |
| --- | --- |
| 01_covering_letter_and_constitution.pdf | 1.0 covering letter, 4.0 constitution of the firm |
| 02_site_tenancy_agreement.pdf | 5.0 site ownership / tenancy |
| 03_plant_master_file.pdf | 6.0 Plant Master File (Appendix I headings) |
| 04_device_master_file.pdf | 8.0 Device Master File (description, specs, labelling, risk, V&V, biocompatibility, software, stability, PMS, batch release) |
| 05_essential_principles_checklist.pdf | 8.8 Essential Principles checklist |
| 06_risk_management_report.pdf | 8.9 risk analysis and control summary |
| 07_label_and_instructions_for_use.pdf | 8.6 labelling (label + IFU) |
| 08_undertaking_fifth_schedule.pdf | 7.1 Fifth Schedule undertaking |
| 09_iso13485_certificate.pdf | QMS certificate |

## Problems planted on purpose

1. **SpO2 accuracy differs:** Device Master File ±2% vs Instructions for Use ±3%.
2. **Patient population differs:** Device Master File says adults; IFU says adults **and paediatric patients**.
3. **Expired certificate:** ISO 13485 certificate "Valid until: 14 March 2026".
4. **No test licence** document (fine if the profile says none was obtained).

Items 1–3 need the AI analysis (Gemini) to extract the values; the exact comparison and date check then run in code. Without AI quota, Evidentra still locates every section by keyword and marks it for human review.

## How to use

Start your own dossier → upload all 9 PDFs → Edit device and pathway: Class C (confirmed), Manufacture in India, IVD No, Licence, Test licence No → Analyse dossier.

Rebuild: `python3 build.py && ./render.sh` (uses Brave or Chrome headless; set `BROWSER_BIN` for another Chromium).
