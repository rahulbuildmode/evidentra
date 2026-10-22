"""Builds the FICTIONAL 'OxiTrack OT-500' dossier (HTML). Render to PDF with render.sh.
Structure follows CDSCO's Form MD-7 checklist. Planted issues are listed in README.md."""
import os
H = os.path.dirname(os.path.abspath(__file__))
BANNER = "FICTIONAL TEST DOSSIER — Evidentra. Example Biomedical Pvt Ltd and the OxiTrack OT-500 are not real. Not a regulatory submission."
CSS = "body{font:11pt Arial;margin:1.8cm;line-height:1.45}h1{font-size:16pt}h2{font-size:13pt;margin-top:18px}.p{page-break-after:always}.f{border:1px solid #888;padding:6px;font-weight:bold;font-size:9pt}table{border-collapse:collapse;width:100%;font-size:10pt}td,th{border:1px solid #999;padding:4px;text-align:left;vertical-align:top}"

def doc(name, pages):
    body = "".join(f'<div class="{"p" if i < len(pages)-1 else ""}"><p class="f">{BANNER}</p>{pg}</div>' for i, pg in enumerate(pages))
    open(os.path.join(H, name + ".html"), "w").write(f'<!doctype html><html><head><meta charset="utf-8"><style>{CSS}</style></head><body>{body}</body></html>')

HDR = lambda no, rev, date: f"<p>Document number: {no} &nbsp; Revision: {rev} &nbsp; Document date: {date}</p>"

doc("01_covering_letter_and_constitution", [
 f"""<h1>Covering Letter</h1>{HDR("EB-REG-001","A","10 September 2026")}
<p>To: The Central Licensing Authority, Central Drugs Standard Control Organisation, New Delhi</p>
<p>Subject: Application in Form MD-7 for grant of licence to manufacture for sale or distribution of a Class C medical device — OxiTrack Fingertip Pulse Oximeter, model OT-500</p>
<p>We, Example Biomedical Pvt Ltd, submit herewith our application in Form MD-7 together with the documents listed in the CDSCO checklist for Form MD-7 and clause (ii) of Part II of the Fourth Schedule of the Medical Devices Rules, 2017.</p>
<p>Device name: OxiTrack Fingertip Pulse Oximeter<br>Generic name: Pulse oximeter<br>Model number: OT-500<br>Risk class: Class C (pulse oximeter, as listed in the CDSCO risk classification list)</p>
<p>Signed: R. Menon, Director, Example Biomedical Pvt Ltd</p>""",
 f"""<h1>Constitution Details of the Firm</h1>{HDR("EB-REG-002","A","10 September 2026")}
<p>Name of the firm: Example Biomedical Pvt Ltd</p>
<p>Constitution: Private limited company incorporated under the Companies Act, 2013. Certificate of incorporation no. U00000MH2019PTC000000 (fictional), dated 4 April 2019.</p>
<p>Registered office and manufacturing site: Unit 7, Example Industrial Estate, Navi Mumbai 400700, Maharashtra, India</p>
<table><tr><th>Director</th><th>Designation</th><th>Shareholding</th></tr>
<tr><td>R. Menon</td><td>Managing Director</td><td>60%</td></tr><tr><td>S. Iyer</td><td>Director (Technical)</td><td>40%</td></tr></table>
<p>Enclosed: memorandum of association, articles of association and certificate of incorporation (copies).</p>"""])

doc("02_site_tenancy_agreement", [
 f"""<h1>Site Tenancy Agreement (Extract)</h1>{HDR("EB-REG-003","A","15 May 2023")}
<p>This lease agreement is made between Example Estates LLP (lessor) and Example Biomedical Pvt Ltd (lessee) for the premises at Unit 7, Example Industrial Estate, Navi Mumbai 400700.</p>
<p>Area: 1,200 square metres on the ground floor, used for manufacturing, quality control and warehousing of medical devices.</p>
<p>Term of tenancy: 9 years from 1 June 2023 to 31 May 2032.</p>
<p>The premises shall be used only for the manufacture and storage of medical devices.</p>"""])

doc("03_plant_master_file", [
 f"""<h1>Plant Master File</h1><p>Prepared as per Appendix I of the Fourth Schedule of the Medical Devices Rules, 2017.</p>{HDR("EB-PMF-001","C","1 August 2026")}
<h2>1. General Information</h2><p>Site: Example Biomedical Pvt Ltd, Unit 7, Example Industrial Estate, Navi Mumbai 400700. Manufacturing activities: assembly, calibration, testing and packing of non-invasive pulse oximeters. No toxic or hazardous substances are handled apart from alkaline batteries, stored in a closed cabinet. Employees: 38 (production 20, quality control 8, warehousing 6, distribution 4).</p>
<h2>2. Personnel</h2><p>Organisation chart: Managing Director; Head of Quality (management representative); Production Manager; QC Manager. Key personnel hold degrees in electronics or biomedical engineering with at least 5 years of medical-device experience. Training is recorded in the training matrix EB-TRN-001.</p>
<h2>3. Premises and Facilities</h2><p>Assembly is performed in a controlled area (ISO class 8 equivalent not required for this non-sterile device). Plant layout drawing EB-LAY-001 (scale 1:100) is attached.</p>""",
 """<h2>4. Equipment</h2><p>List of equipment and instruments used for manufacturing and testing: SpO2 simulator (calibrated), electrical safety analyser, environmental test chamber, torque drivers, label printer.</p>
<h2>5. Sanitation</h2><p>Cleaning schedule SOP EB-SOP-012; pest control by contracted agency every quarter.</p>
<h2>6. Production</h2><p>Process flow: incoming inspection, PCB assembly (outsourced, approved supplier), final assembly, calibration against SpO2 simulator, functional test, packing.</p>
<h2>7. Quality Assurance</h2><p>Quality management system per ISO 13485:2016 and the Fifth Schedule of the Medical Devices Rules, 2017.</p>
<h2>8. Storage</h2><p>Finished goods stored at 10–40 °C in a segregated warehouse area.</p>
<h2>9. Documentation</h2><p>Document control per SOP EB-SOP-001; device history records retained for the device lifetime plus two years.</p>"""])

doc("04_device_master_file", [
 f"""<h1>Device Master File</h1><p>Prepared in the line of Appendix II of the Fourth Schedule of the Medical Devices Rules, 2017.</p>{HDR("EB-DMF-001","D","20 August 2026")}
<h2>1.0 Executive Summary</h2><p>The OxiTrack OT-500 is a battery-powered fingertip pulse oximeter for spot-check measurement of functional oxygen saturation and pulse rate. It is a Class C medical device.</p>
<h2>2.1 Device Description</h2>
<p>Device name: OxiTrack Fingertip Pulse Oximeter</p><p>Generic name: Pulse oximeter</p><p>Model number: OT-500</p>
<p>Manufacturer: Example Biomedical Pvt Ltd</p>
<p>Materials of construction: polycarbonate housing; medical-grade silicone finger pad; LED emitter and photodiode sensor.</p>
<p>Intended use: Spot-check, non-invasive measurement of functional oxygen saturation (SpO2) and pulse rate in adults in hospitals, clinics and the home.</p>
<p>Indications: patients requiring spot-checks of oxygen saturation. Contraindications: not for continuous monitoring or for use on neonates.</p>
<p>Warnings: readings may be inaccurate with low perfusion, nail polish or excessive movement.</p>""",
 """<h2>2.2 Product Specification</h2>
<p>SpO2 measurement range: 70% to 100%</p><p>SpO2 accuracy: ±2% (70% to 100%)</p><p>Pulse rate range: 30 to 240 bpm</p><p>Power supply: two AAA 1.5 V alkaline batteries</p><p>Display: OLED</p>
<h2>3.0 Labelling</h2><p>The label and instructions for use are provided in document EB-LBL-001.</p>
<h2>6.0 Risk analysis and control summary</h2><p>Risk analysis was performed per ISO 14971:2019 using FMEA. Identified hazards and controls are summarised in the risk management report EB-RMR-001. All residual risks were evaluated as acceptable and the overall residual risk is acceptable.</p>
<h2>7.1 Verification and validation</h2><p>Electrical safety and essential performance: tested to IEC 60601-1 and ISO 80601-2-61 (report EB-TR-014, pass). SpO2 accuracy validated by a controlled desaturation study (ARMS 1.8%).</p>""",
 """<h2>7.2 Biocompatibility</h2>
<p>Materials in direct contact with the patient: medical-grade silicone finger pad (surface contact with intact skin, limited duration) and polycarbonate housing.</p>
<p>Biocompatibility testing per ISO 10993-1, ISO 10993-5 (cytotoxicity) and ISO 10993-10 (sensitisation and irritation) was performed on the finished device. Result: no cytotoxicity, sensitisation or irritation (report EB-BIO-003).</p>
<h2>7.3 Software</h2><p>Embedded firmware version 2.1, software safety class B per IEC 62304; verification and validation report EB-SW-002.</p>
<h2>7.4 Stability</h2><p>Shelf life of 3 years supported by accelerated ageing study EB-STB-001.</p>
<h2>8.0 Post-marketing surveillance</h2><p>Complaints and adverse events are handled per SOP EB-SOP-020 and reported as required under the Medical Devices Rules, 2017.</p>
<h2>Batch release</h2><p>Certificates of analysis for three consecutive batches (OT5-2601, OT5-2602, OT5-2603) are enclosed.</p>"""])

doc("05_essential_principles_checklist", [
 f"""<h1>Essential Principles Checklist</h1><p>Essential Principles checklist for demonstrating conformity to the Essential Principles of Safety and Performance of the medical device OxiTrack OT-500.</p>{HDR("EB-EPC-001","B","20 August 2026")}
<table><tr><th>Essential Principle</th><th>Applicable</th><th>Method of conformity</th><th>Document reference</th></tr>
<tr><td>General requirements — safety and performance</td><td>Yes</td><td>ISO 14971 risk management</td><td>EB-RMR-001</td></tr>
<tr><td>Chemical, physical and biological properties</td><td>Yes</td><td>ISO 10993-1, -5, -10</td><td>EB-BIO-003</td></tr>
<tr><td>Infection and microbial contamination</td><td>No</td><td>Non-sterile device for intact skin</td><td>—</td></tr>
<tr><td>Electrical safety and EMC</td><td>Yes</td><td>IEC 60601-1, IEC 60601-1-2</td><td>EB-TR-014</td></tr>
<tr><td>Devices with a measuring function</td><td>Yes</td><td>ISO 80601-2-61, desaturation study</td><td>EB-TR-014</td></tr>
<tr><td>Software</td><td>Yes</td><td>IEC 62304</td><td>EB-SW-002</td></tr>
<tr><td>Labelling and instructions for use</td><td>Yes</td><td>Chapter VI of MDR 2017</td><td>EB-LBL-001</td></tr></table>"""])

doc("06_risk_management_report", [
 f"""<h1>Risk Management Report</h1>{HDR("EB-RMR-001","C","18 August 2026")}
<p>Device: OxiTrack Fingertip Pulse Oximeter, model OT-500</p>
<p>Risk analysis technique: FMEA per ISO 14971:2019.</p>
<table><tr><th>Hazard</th><th>Risk control</th><th>Residual risk</th></tr>
<tr><td>Inaccurate SpO2 reading (low perfusion, movement)</td><td>Signal-quality indicator; warning in IFU</td><td>Acceptable</td></tr>
<tr><td>Skin irritation from finger pad</td><td>Biocompatible silicone (ISO 10993)</td><td>Acceptable</td></tr>
<tr><td>Electric shock</td><td>Battery powered; IEC 60601-1 compliant design</td><td>Acceptable</td></tr>
<tr><td>Battery depletion during measurement</td><td>Low-battery indicator</td><td>Acceptable</td></tr>
<tr><td>Use on neonates</td><td>Contraindication in IFU</td><td>Acceptable</td></tr></table>
<p>Overall residual risk evaluation: the overall residual risk is acceptable and the benefits outweigh the residual risks.</p>"""])

doc("07_label_and_instructions_for_use", [
 f"""<h1>Label</h1>{HDR("EB-LBL-001","B","22 August 2026")}
<p>OxiTrack Fingertip Pulse Oximeter</p><p>Model: OT-500</p><p>Manufactured by: Example Biomedical Pvt Ltd, Navi Mumbai, India</p><p>Batch: OT5-XXXX &nbsp; Mfg date / Expiry: see pack</p><p>Licence no.: to be issued</p>""",
 """<h1>Instructions for Use</h1>
<p>OxiTrack Fingertip Pulse Oximeter, model OT-500.</p>
<p>Intended use: Spot-check measurement of functional oxygen saturation (SpO2) and pulse rate in adults and paediatric patients in hospitals, clinics and the home.</p>
<h2>Specifications</h2><p>SpO2 measurement range: 70% to 100%</p><p>SpO2 accuracy: ±3% (70% to 100%)</p><p>Pulse rate range: 30 to 240 bpm</p><p>Batteries: two AAA 1.5 V alkaline batteries</p>
<h2>Warnings</h2><p>Do not use on neonates. Readings may be inaccurate with nail polish, low perfusion or movement.</p>"""])

doc("08_undertaking_fifth_schedule", [
 f"""<h1>Undertaking</h1>{HDR("EB-REG-004","A","10 September 2026")}
<p>We, Example Biomedical Pvt Ltd, Unit 7, Example Industrial Estate, Navi Mumbai 400700, hereby undertake that our manufacturing site is in compliance with the provisions of the Fifth Schedule of the Medical Devices Rules, 2017 (Quality Management System for medical devices).</p>
<p>Signed: R. Menon, Managing Director &nbsp; Date: 10 September 2026 &nbsp; Seal: (company seal)</p>"""])

doc("09_iso13485_certificate", [
 f"""<h1>Certificate of Registration — ISO 13485:2016</h1>
<p>Certificate No.: EXCB-13485-0042 (fictional)</p>
<p>Certificate holder: Example Biomedical Pvt Ltd</p>
<p>Site: Unit 7, Example Industrial Estate, Navi Mumbai 400700, India</p>
<p>Scope: Design, manufacture and distribution of non-invasive pulse oximeters.</p>
<p>Standard: ISO 13485:2016</p>
<p>Issue date: 15 March 2023</p>
<p>Valid until: 14 March 2026</p>
<p>Issued by: Example Certification Body (fictional)</p>"""])
print("ok")
