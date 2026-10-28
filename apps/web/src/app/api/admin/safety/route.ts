import { DatabaseNotConfigured, getDb } from "../../../../lib/db/client";
import { pendingReviews } from "../../../../lib/safety/store";
import { requireAdmin } from "../../../../lib/require-admin";

/** Designs waiting for an admin to approve or reject them. */
export async function GET() {
  const who = await requireAdmin();
  if ("response" in who) return who.response;
  try {
    return Response.json({ reviews: await pendingReviews(await getDb()) }, { headers: { "cache-control": "private, no-store" } });
  } catch (error) {
    if (!(error instanceof DatabaseNotConfigured)) console.error("database unavailable", error);
    return Response.json({ error: "The database is not available." }, { status: 503 });
  }
}
