import { extractText, getDocumentProxy } from "unpdf";
import type { PageText } from "../uploads";

export type ExtractResult =
  | { ok: true; pages: PageText[]; pageCount: number }
  | { ok: false; error: string };

/** Turn pdf.js error names into messages a non-engineer can act on. */
function explain(err: unknown): string {
  const name = err instanceof Error ? err.name : "";
  if (name === "PasswordException") return "This PDF is password-protected. Remove the password and upload it again.";
  if (name === "InvalidPDFException") return "This file is not a valid PDF or is damaged.";
  if (name === "MissingPDFException") return "The PDF data could not be read.";
  return "The PDF could not be read. It may be damaged or use an unsupported format.";
}

export async function extractPdfPages(bytes: Uint8Array): Promise<ExtractResult> {
  try {
    // pdf.js may take ownership of the buffer, so give it a copy.
    const pdf = await getDocumentProxy(new Uint8Array(bytes));
    const { totalPages, text } = await extractText(pdf, { mergePages: false });
    const pages = text.map((t, i) => ({ page: i + 1, text: t.replace(/\u0000/g, "").trim() }));
    return { ok: true, pages, pageCount: totalPages };
  } catch (err) {
    console.error("[pdf-extract]", err instanceof Error ? `${err.name}: ${err.message}` : err);
    return { ok: false, error: explain(err) };
  }
}
