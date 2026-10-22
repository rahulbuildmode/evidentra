import { deleteDocument, getDocument } from "@/lib/server/document-store";
import { isSafeId } from "@/lib/uploads";

const fail = (status: number, error: string) => Response.json({ error }, { status });

// GET /api/documents/:id?workspaceId=... → full record including page text
export async function GET(request: Request, ctx: RouteContext<"/api/documents/[id]">) {
  const { id } = await ctx.params;
  const workspaceId = new URL(request.url).searchParams.get("workspaceId");
  if (!isSafeId(workspaceId) || !isSafeId(id)) return fail(400, "Invalid id.");
  const doc = await getDocument(workspaceId, id);
  if (!doc) return fail(404, "Document not found in this workspace.");
  return Response.json({ document: doc });
}

// DELETE /api/documents/:id?workspaceId=...
export async function DELETE(request: Request, ctx: RouteContext<"/api/documents/[id]">) {
  const { id } = await ctx.params;
  const workspaceId = new URL(request.url).searchParams.get("workspaceId");
  if (!isSafeId(workspaceId) || !isSafeId(id)) return fail(400, "Invalid id.");
  const existed = await deleteDocument(workspaceId, id);
  if (!existed) return fail(404, "Document not found in this workspace.");
  return Response.json({ ok: true });
}
