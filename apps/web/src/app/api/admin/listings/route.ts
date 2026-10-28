import { DatabaseNotConfigured, getDb } from "../../../../lib/db/client";
import { reportError } from "../../../../lib/observability";
import { requireAdmin } from "../../../../lib/require-admin";
import { pendingListings } from "../../../../lib/stores/review";

/** Listings waiting for an admin's decision. */
export async function GET() {
  const who = await requireAdmin();
  if ("response" in who) return who.response;
  try {
    return Response.json({ listings: await pendingListings(await getDb()) }, { headers: { "cache-control": "private, no-store" } });
  } catch (error) {
    if (!(error instanceof DatabaseNotConfigured)) await reportError("database unavailable", error);
    return Response.json({ error: "The database is not available." }, { status: 503 });
  }
}
