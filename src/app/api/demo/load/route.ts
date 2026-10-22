import { loadDemo } from "@/lib/server/demo-loader";

// POST /api/demo/load → (re)load the fictional demo dossier into the demo workspace.
export async function POST() {
  try {
    return Response.json({ ok: true, ...(await loadDemo()) });
  } catch (err) {
    console.error("[demo] load failed", err);
    return Response.json({ error: "The demo dossier could not be loaded." }, { status: 500 });
  }
}
