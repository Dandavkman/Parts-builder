import { DatabaseNotConfigured, getDb } from "../../../lib/db/client";
import { listOwnedOrders } from "../../../lib/orders/store";
import { requireOwner } from "../../../lib/require-owner";

/** The signed-in user's orders, newest first. */
export async function GET() {
  const who = await requireOwner();
  if ("response" in who) return who.response;
  try {
    const orders = await listOwnedOrders(await getDb(), who.ownerId);
    return Response.json({ orders }, { headers: { "cache-control": "private, no-store" } });
  } catch (error) {
    if (!(error instanceof DatabaseNotConfigured)) console.error("database unavailable", error);
    return Response.json({ error: "The database is not available." }, { status: 503 });
  }
}
