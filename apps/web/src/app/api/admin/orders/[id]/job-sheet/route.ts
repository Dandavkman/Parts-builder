import { DatabaseNotConfigured, getDb } from "../../../../../../lib/db/client";
import { getOrder } from "../../../../../../lib/orders/store";
import { jobSheet } from "../../../../../../lib/partners/manual";
import { requireAdmin } from "../../../../../../lib/require-admin";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The one-page job sheet for an order, as plain text. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const who = await requireAdmin();
  if ("response" in who) return who.response;
  const { id } = await params;
  if (!UUID.test(id)) return Response.json({ error: "Not an order." }, { status: 400 });
  try {
    const order = await getOrder(await getDb(), id);
    if (!order) return Response.json({ error: "Order not found." }, { status: 404 });
    return new Response(jobSheet(order), { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "private, no-store" } });
  } catch (error) {
    if (!(error instanceof DatabaseNotConfigured)) console.error("database unavailable", error);
    return Response.json({ error: "The database is not available." }, { status: 503 });
  }
}
