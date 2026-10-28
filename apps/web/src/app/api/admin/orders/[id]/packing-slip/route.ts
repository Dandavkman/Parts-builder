import { DatabaseNotConfigured, getDb } from "../../../../../../lib/db/client";
import { orderBrand } from "../../../../../../lib/email/order-brand";
import { renderPackingSlip } from "../../../../../../lib/email/packing-slip";
import { reportError } from "../../../../../../lib/observability";
import { getOrder } from "../../../../../../lib/orders/store";
import { requireAdmin } from "../../../../../../lib/require-admin";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The packing slip for an order, as plain text: the seller's store name for a store order. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const who = await requireAdmin();
  if ("response" in who) return who.response;
  const { id } = await params;
  if (!UUID.test(id)) return Response.json({ error: "Not an order." }, { status: 400 });
  try {
    const db = await getDb();
    const order = await getOrder(db, id);
    if (!order) return Response.json({ error: "Order not found." }, { status: 404 });
    return new Response(renderPackingSlip(order, await orderBrand(db, order)), { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "private, no-store" } });
  } catch (error) {
    if (!(error instanceof DatabaseNotConfigured)) await reportError("database unavailable", error);
    return Response.json({ error: "The database is not available." }, { status: 503 });
  }
}
