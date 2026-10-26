import { getOwnedDesign, resolvePendingDimension } from "../../../../../lib/agent/store";
import { DatabaseNotConfigured, getDb } from "../../../../../lib/db/client";
import { requireOwner } from "../../../../../lib/require-owner";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The user's answer to a value the agent found online: `{ id, action: "confirm", value_mm? }` or
 * `{ id, action: "reject" }`. Only the owner can answer, and only a confirmed value reaches the agent.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const who = await requireOwner();
  if ("response" in who) return who.response;
  const { id: designId } = await params;
  if (!UUID.test(designId)) return Response.json({ error: "Not a design." }, { status: 400 });
  const body = (await request.json().catch(() => null)) as { id?: unknown; action?: unknown; value_mm?: unknown } | null;
  if (typeof body?.id !== "string" || (body.action !== "confirm" && body.action !== "reject")) {
    return Response.json({ error: "Send { id, action: 'confirm' | 'reject' }." }, { status: 400 });
  }
  const value = body.value_mm;
  if (value !== undefined && (typeof value !== "number" || !Number.isFinite(value) || value <= 0 || value > 5000)) {
    return Response.json({ error: "value_mm must be a number above 0 and at most 5000." }, { status: 400 });
  }
  try {
    const db = await getDb();
    if (!(await getOwnedDesign(db, designId, who.ownerId))) {
      return Response.json({ error: "Design not found." }, { status: 404 });
    }
    const outcome = await resolvePendingDimension(
      db,
      designId,
      body.id,
      body.action === "confirm" ? { action: "confirm", value_mm: value as number | undefined } : { action: "reject" },
    );
    if (outcome === "not_found") return Response.json({ error: "No suggestion with that id is waiting." }, { status: 404 });
    return Response.json({ ok: true });
  } catch (error) {
    if (!(error instanceof DatabaseNotConfigured)) console.error("database unavailable", error);
    return Response.json({ error: "The database is not available." }, { status: 503 });
  }
}
