import { listOwnedDesigns } from "../../../lib/agent/store";
import { DatabaseNotConfigured, getDb } from "../../../lib/db/client";
import { requireOwner } from "../../../lib/require-owner";
import { reportError } from "../../../lib/observability";

/** The signed-in user's designs, newest first. */
export async function GET() {
  const who = await requireOwner();
  if ("response" in who) return who.response;
  try {
    return Response.json(
      { designs: await listOwnedDesigns(await getDb(), who.ownerId) },
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
