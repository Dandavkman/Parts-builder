import { DatabaseNotConfigured, getDb } from "../../../../lib/db/client";
import { reportError } from "../../../../lib/observability";
import { requireOwner } from "../../../../lib/require-owner";
import { storeStats } from "../../../../lib/stores/stats";
import { getOwnedStore } from "../../../../lib/stores/store";

/** The signed-in seller's sales per listing, with totals and what they are owed. Only their own store is returned. */
export async function GET() {
  const who = await requireOwner();
  if ("response" in who) return who.response;
  try {
    const db = await getDb();
    const store = await getOwnedStore(db, who.ownerId);
    if (!store) return Response.json({ error: "You have no store." }, { status: 404 });
    return Response.json(await storeStats(db, store.id), { headers: { "cache-control": "private, no-store" } });
  } catch (error) {
    if (!(error instanceof DatabaseNotConfigured)) await reportError("database unavailable", error);
    return Response.json({ error: "The database is not available." }, { status: 503 });
  }
}
