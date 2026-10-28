import { DatabaseNotConfigured, getDb } from "../../../../lib/db/client";
import { reportError } from "../../../../lib/observability";
import { requireOwner } from "../../../../lib/require-owner";
import { claimsForSeller } from "../../../../lib/takedowns/takedowns";

/** Claims against the signed-in seller's listings: their notices. */
export async function GET() {
  const who = await requireOwner();
  if ("response" in who) return who.response;
  try {
    return Response.json({ claims: await claimsForSeller(await getDb(), who.ownerId) }, { headers: { "cache-control": "private, no-store" } });
  } catch (error) {
    if (!(error instanceof DatabaseNotConfigured)) await reportError("database unavailable", error);
    return Response.json({ error: "The database is not available." }, { status: 503 });
  }
}
