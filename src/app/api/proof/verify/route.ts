import { checkCitation } from "@/lib/server/verify-quotes";
import { loadReadableDocuments } from "@/lib/server/workspace-docs";
import { isSafeId } from "@/lib/uploads";

const fail = (status: number, code: string, error: string) => Response.json({ code, error }, { status });

/**
 * POST /api/proof/verify { workspaceId, filename, page, quote } → runs the real quote verifier on a
 * test quotation against this workspace's extracted text. Read-only: nothing is saved or added to results.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const workspaceId = body?.workspaceId;
  if (!isSafeId(workspaceId)) return fail(400, "bad_request", "Missing or invalid workspace id.");
  const filename = typeof body?.filename === "string" ? body.filename.slice(0, 300) : "";
  const quote = typeof body?.quote === "string" ? body.quote.slice(0, 600) : "";
  const page = Number.isInteger(body?.page) && body.page > 0 ? (body.page as number) : null;
  if (!filename || !quote.trim()) return fail(400, "bad_request", "A file name and a quotation are required.");
  const { docs } = await loadReadableDocuments(workspaceId);
  if (docs.length === 0) return fail(400, "no_documents", "This dossier has no documents with extractable text to check against.");
  return Response.json({ result: checkCitation({ filename, page, quote }, docs) });
}
