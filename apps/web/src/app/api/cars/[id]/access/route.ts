import { DatabaseNotConfigured, getDb } from "../../../../../lib/db/client";
import { accessFor } from "../../../../../lib/licenses/licenses";
import { reportError } from "../../../../../lib/observability";
import { requireOwner } from "../../../../../lib/require-owner";

/** Which scanned areas of this car the signed-in user may use in the workspace. Never returns scan data. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const who = await requireOwner();
  if ("response" in who) return who.response;
  const { id } = await params;
  try {
    const access = await accessFor(await getDb(), who.ownerId, id);
    if (!access) return Response.json({ error: "Car not found." }, { status: 404 });
    return Response.json({ access }, { headers: { "cache-control": "private, no-store" } });
  } catch (error) {
    if (!(error instanceof DatabaseNotConfigured)) await reportError("database unavailable", error);
    return Response.json({ error: "The database is not available." }, { status: 503 });
  }
}
