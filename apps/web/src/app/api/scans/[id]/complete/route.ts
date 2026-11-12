import { DatabaseNotConfigured, getDb } from "../../../../../lib/db/client";
import { reportError } from "../../../../../lib/observability";
import { requireOwner } from "../../../../../lib/require-owner";
import { attachScan, markUploaded } from "../../../../../lib/scans/store";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Marks the upload finished. With `{ design_id }` it also attaches the scan to that design. Owner only. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const who = await requireOwner();
  if ("response" in who) return who.response;
  const { id } = await params;
  if (!UUID.test(id)) return Response.json({ error: "Not a scan." }, { status: 400 });
  const body = (await request.json().catch(() => null)) as { design_id?: unknown } | null;
  const designId = body?.design_id;
  if (designId !== undefined && (typeof designId !== "string" || !UUID.test(designId))) return Response.json({ error: "design_id must be a design id." }, { status: 400 });
  try {
    const db = await getDb();
    if (!(await markUploaded(db, id, who.ownerId))) return Response.json({ error: "Scan not found." }, { status: 404 });
    if (designId && !(await attachScan(db, designId as string, id, who.ownerId))) return Response.json({ error: "Design not found." }, { status: 404 });
    return Response.json({ ok: true });
  } catch (error) {
    if (!(error instanceof DatabaseNotConfigured)) await reportError("database unavailable", error);
    return Response.json({ error: "The database is not available." }, { status: 503 });
  }
}
