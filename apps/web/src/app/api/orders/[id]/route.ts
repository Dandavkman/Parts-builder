import { DatabaseNotConfigured, getDb } from "../../../../lib/db/client";
import { getOwnedOrder } from "../../../../lib/orders/store";
import { requireOwner } from "../../../../lib/require-owner";
import { reportError } from "../../../../lib/observability";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** One of the signed-in user's orders, with the quote it was bought on. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const who = await requireOwner();
  if ("response" in who) return who.response;
  const { id } = await params;
  if (!UUID.test(id)) return Response.json({ error: "Not an order." }, { status: 400 });
  try {
    const order = await getOwnedOrder(await getDb(), id, who.ownerId);
    if (!order) return Response.json({ error: "Order not found." }, { status: 404 });
    return Response.json({ order }, { headers: { "cache-control": "private, no-store" } });
  } catch (error) {
    if (!(error instanceof DatabaseNotConfigured)) await reportError("database unavailable", error);
    return Response.json({ error: "The database is not available." }, { status: 503 });
  }
}
