import { listOwnedDesigns } from "../../../lib/agent/store";
import { DatabaseNotConfigured, getDb } from "../../../lib/db/client";
import { requireOwner } from "../../../lib/require-owner";

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
      console.error("database unavailable", error);
    return Response.json(
      { error: "The database is not available." },
      { status: 503 },
    );
  }
}
