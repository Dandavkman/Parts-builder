import { notifyOrder } from "../../../../../lib/email/notify";
import { eventForMove } from "../../../../../lib/email/templates";
import { DatabaseNotConfigured, getDb } from "../../../../../lib/db/client";
import { isOrderStatus } from "../../../../../lib/orders/status";
import { getOrder, moveOrder } from "../../../../../lib/orders/store";
import { requireAdmin } from "../../../../../lib/require-admin";
import { reportError } from "../../../../../lib/observability";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const short = (v: unknown) => (typeof v === "string" && v.trim() && v.length <= 200 ? v.trim() : undefined);

/** Moves an order along its flow. Body: `{ status, trackingNumber?, partnerOrderRef? }`. Refunds here only record the status; the money is returned in Stripe. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const who = await requireAdmin();
  if ("response" in who) return who.response;
  const { id } = await params;
  if (!UUID.test(id)) return Response.json({ error: "Not an order." }, { status: 400 });
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || !isOrderStatus(body.status)) return Response.json({ error: "A valid status is required." }, { status: 400 });
  const trackingNumber = short(body.trackingNumber);
  const partnerOrderRef = short(body.partnerOrderRef);
  if (body.status === "shipped" && !trackingNumber) return Response.json({ error: "A tracking number is required to mark an order shipped." }, { status: 400 });
  try {
    const db = await getDb();
    const before = (await getOrder(db, id))?.status ?? "";
    const moved = await moveOrder(db, id, body.status, {
      ...(trackingNumber ? { trackingNumber } : {}),
      ...(partnerOrderRef ? { partnerOrderRef } : {}),
    });
    if (!moved.ok) {
      return moved.reason === "not_found"
        ? Response.json({ error: "Order not found." }, { status: 404 })
        : Response.json({ error: "The order cannot move to that status from where it is." }, { status: 409 });
    }
    const event = eventForMove(before, moved.order.status);
    if (event) await notifyOrder(db, moved.order, event);
    return Response.json({ order: moved.order });
  } catch (error) {
    if (!(error instanceof DatabaseNotConfigured)) await reportError("database unavailable", error);
    return Response.json({ error: "The database is not available." }, { status: 503 });
  }
}
