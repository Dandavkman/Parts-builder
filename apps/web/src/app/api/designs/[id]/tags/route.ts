import { getOwnedDesign } from "../../../../../lib/agent/store";
import { DatabaseNotConfigured, getDb } from "../../../../../lib/db/client";
import { reportError } from "../../../../../lib/observability";
import { requireOwner } from "../../../../../lib/require-owner";
import { tagDesign, tagsFor } from "../../../../../lib/vehicles/tags";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The cars this design is tagged for. Owner only. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const who = await requireOwner();
  if ("response" in who) return who.response;
  const { id } = await params;
  if (!UUID.test(id)) return Response.json({ error: "Not a design." }, { status: 400 });
  try {
    const db = await getDb();
    if (!(await getOwnedDesign(db, id, who.ownerId))) return Response.json({ error: "Design not found." }, { status: 404 });
    return Response.json({ vehicleIds: await tagsFor(db, id) }, { headers: { "cache-control": "private, no-store" } });
  } catch (error) {
    if (!(error instanceof DatabaseNotConfigured)) await reportError("database unavailable", error);
    return Response.json({ error: "The database is not available." }, { status: 503 });
  }
}

/** `{ vehicleId, area }`: tag the design with every car that scan covers. The user must hold the scan. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const who = await requireOwner();
  if ("response" in who) return who.response;
  const { id } = await params;
  if (!UUID.test(id)) return Response.json({ error: "Not a design." }, { status: 400 });
  const body = (await request.json().catch(() => null)) as { vehicleId?: unknown; area?: unknown } | null;
  try {
    const result = await tagDesign(await getDb(), who.ownerId, id, body?.vehicleId, body?.area);
    if (!result.ok) return Response.json({ error: result.error }, { status: result.status });
    return Response.json({ vehicleIds: result.vehicleIds });
  } catch (error) {
    if (!(error instanceof DatabaseNotConfigured)) await reportError("database unavailable", error);
    return Response.json({ error: "The database is not available." }, { status: 503 });
  }
}
