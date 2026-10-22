import { readFile } from "node:fs/promises";
import path from "node:path";

/**
 * GET /api/proof/fixture?name=blank|injection → one of the fictional test PDFs, so the browser can
 * send it through the normal upload endpoint (same validation and extraction as any upload).
 */
const FIXTURES: Record<string, string> = {
  blank: "blank_scan_no_text.pdf",
  injection: "device_description_AP-200A.pdf",
};

export async function GET(request: Request) {
  const name = new URL(request.url).searchParams.get("name") ?? "";
  const file = FIXTURES[name];
  if (!file) return Response.json({ error: "Unknown test fixture." }, { status: 404 });
  const bytes = await readFile(path.join(process.cwd(), "fixtures", file));
  return new Response(bytes, { headers: { "content-type": "application/pdf", "content-disposition": `inline; filename="${file}"` } });
}
