import type { ModelOutput } from "../analysis";

/**
 * FICTIONAL demo seed for fixtures/demo-dossier. Written by hand, not AI output.
 * Every quotation below is copied from the demo PDFs and is re-verified by code against
 * the extracted text each time the demo loads; anything that fails is shown as unverified.
 */

export const DEMO_FILES = [
  "01_device_master_file_summary.pdf",
  "02_instructions_for_use.pdf",
  "03_risk_management_summary.pdf",
  "04_qms_certificate_sample.pdf",
] as const;

const [DMF, IFU, RMS, QMS] = DEMO_FILES;
const c = (filename: string, page: number, quote: string) => ({ filename, page, quote });

export const DEMO_ANALYSIS: ModelOutput = {
  facts: [
    { category: "device_name", label: "Device name", value: "AuraPulse Fingertip Pulse Oximeter", normalized_date: null, citation: c(DMF, 1, "Device name: AuraPulse Fingertip Pulse Oximeter"), confidence: "high" },
    { category: "device_name", label: "Device name", value: "AuraPulse Fingertip Pulse Oximeter", normalized_date: null, citation: c(IFU, 1, "AuraPulse Fingertip Pulse Oximeter"), confidence: "high" },
    { category: "model_number", label: "Model number", value: "AP-200A", normalized_date: null, citation: c(DMF, 1, "Model number: AP-200A"), confidence: "high" },
    { category: "model_number", label: "Model", value: "AP-2000A", normalized_date: null, citation: c(IFU, 1, "Model: AP-2000A"), confidence: "high" },
    { category: "model_number", label: "Model", value: "AP-200A", normalized_date: null, citation: c(RMS, 1, "Device: AuraPulse Fingertip Pulse Oximeter, model AP-200A"), confidence: "high" },
    { category: "manufacturer_name", label: "Manufacturer", value: "Fictional MedTech Pvt Ltd", normalized_date: null, citation: c(DMF, 1, "Manufacturer: Fictional MedTech Pvt Ltd"), confidence: "high" },
    { category: "manufacturer_name", label: "Manufactured by", value: "Fictional MedTech Pvt Ltd", normalized_date: null, citation: c(IFU, 1, "Manufactured by Fictional MedTech Pvt Ltd, Pune, India."), confidence: "high" },
    { category: "manufacturer_name", label: "Certificate holder", value: "Fictional MedTech Pvt Ltd", normalized_date: null, citation: c(QMS, 1, "Certificate holder: Fictional MedTech Pvt Ltd"), confidence: "high" },
    { category: "manufacturer_address", label: "Manufacturer address", value: "Plot 12, Example Industrial Area, Pune 411000, India", normalized_date: null, citation: c(DMF, 1, "Manufacturer address: Plot 12, Example Industrial Area, Pune 411000, India"), confidence: "high" },
    { category: "intended_use", label: "Intended use", value: "Spot-check, non-invasive measurement of functional oxygen saturation (SpO2) and pulse rate in adults.", normalized_date: null, citation: c(DMF, 1, "Intended use: Spot-check, non-invasive measurement of functional oxygen saturation (SpO2) and pulse rate in adults."), confidence: "high" },
    { category: "intended_use", label: "Intended use", value: "Spot-check, non-invasive measurement of functional oxygen saturation (SpO2) and pulse rate in adults.", normalized_date: null, citation: c(IFU, 1, "Intended use: Spot-check, non-invasive measurement of functional oxygen saturation (SpO2) and pulse rate in adults."), confidence: "high" },
    { category: "technical_specification", label: "SpO2 accuracy", value: "±2% (70% to 100%)", normalized_date: null, citation: c(DMF, 2, "SpO2 accuracy: ±2% (70% to 100%)"), confidence: "high" },
    { category: "technical_specification", label: "SpO2 accuracy", value: "±2% (70% to 100%)", normalized_date: null, citation: c(IFU, 2, "SpO2 accuracy: ±2% (70% to 100%)"), confidence: "high" },
    { category: "technical_specification", label: "Pulse rate range", value: "30 to 250 bpm", normalized_date: null, citation: c(DMF, 2, "Pulse rate range: 30 to 250 bpm"), confidence: "high" },
    { category: "technical_specification", label: "Pulse rate range", value: "30 to 250 bpm", normalized_date: null, citation: c(IFU, 2, "Pulse rate range: 30 to 250 bpm"), confidence: "high" },
    { category: "referenced_standard", label: "QMS standard", value: "ISO 13485:2016", normalized_date: null, citation: c(QMS, 1, "Standard: ISO 13485:2016"), confidence: "high" },
    { category: "document_revision", label: "Revision", value: "B", normalized_date: null, citation: c(DMF, 1, "Revision: B"), confidence: "high" },
    { category: "document_revision", label: "Revision", value: "A", normalized_date: null, citation: c(IFU, 1, "Revision: A"), confidence: "high" },
    { category: "document_revision", label: "Revision", value: "A", normalized_date: null, citation: c(RMS, 1, "Revision: A"), confidence: "high" },
    { category: "document_date", label: "Document date", value: "12 March 2026", normalized_date: "2026-03-12", citation: c(DMF, 1, "Document date: 12 March 2026"), confidence: "high" },
    { category: "document_date", label: "Document date", value: "05 February 2026", normalized_date: "2026-02-05", citation: c(IFU, 1, "Document date: 05 February 2026"), confidence: "high" },
    { category: "document_date", label: "Document date", value: "20 February 2026", normalized_date: "2026-02-20", citation: c(RMS, 1, "Document date: 20 February 2026"), confidence: "high" },
    { category: "document_date", label: "Valid until", value: "30 June 2027", normalized_date: "2027-06-30", citation: c(QMS, 1, "Valid until: 30 June 2027"), confidence: "high" },
  ],
  inconsistencies: [
    {
      topic: "Model number",
      explanation: "The device master file summary gives model number AP-200A, while the instructions for use give AP-2000A.",
      citations: [c(DMF, 1, "Model number: AP-200A"), c(IFU, 1, "Model: AP-2000A")],
      confidence: "high",
    },
  ],
  missing_information: [
    {
      topic: "Biocompatibility of patient-contacting materials",
      explanation: "No list of patient-contacting materials or biocompatibility evaluation was found in the uploaded documents.",
      confidence: "high",
    },
  ],
};
