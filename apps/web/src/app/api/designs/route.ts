import { listOwnedDesigns } from "../../../lib/agent/store";
import { DatabaseNotConfigured, getDb } from "../../../lib/db/client";
import { ownedDesignsForVehicle } from "../../../lib/vehicles/tags";
import { requireOwner } from "../../../lib/require-owner";
import { reportError } from "../../../lib/observability";

/** The signed-in user's designs, newest first. `?vehicle=<car id>` keeps only designs tagged for that car. */
export async function GET(request: Request) {
  const who = await requireOwner();
  if ("response" in who) return who.response;
  try {
    const vehicle = new URL(request.url).searchParams.get("vehicle");
    const db = await getDb();
    return Response.json(
      { designs: vehicle ? await ownedDesignsForVehicle(db, who.ownerId, vehicle) : await listOwnedDesigns(db, who.ownerId) },
      { headers: { "cache-control": "private, no-store" } },
    );
  } catch (error) {
    if (!(error instanceof DatabaseNotConfigured))
      await reportError("database unavailable", error);
    return Response.json(
      { error: "The database is not available." },
      { status: 503 },
    );
  }
}
