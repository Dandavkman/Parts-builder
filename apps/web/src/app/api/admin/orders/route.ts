import { DatabaseNotConfigured, getDb } from "../../../../lib/db/client";
import { isOrderStatus } from "../../../../lib/orders/status";
import { listAllOrders } from "../../../../lib/orders/store";
import { requireAdmin } from "../../../../lib/require-admin";

/** All orders for the admin console. `?status=` narrows to one status. */
export async function GET(request: Request) {
  const who = await requireAdmin();
  if ("response" in who) return who.response;
  const status = new URL(request.url).searchParams.get("status") ?? undefined;
  if (status !== undefined && !isOrderStatus(status)) return Response.json({ error: "Unknown status." }, { status: 400 });
  try {
    const orders = await listAllOrders(await getDb(), status);
    return Response.json({ orders }, { headers: { "cache-control": "private, no-store" } });
  } catch (error) {
    if (!(error instanceof DatabaseNotConfigured)) console.error("database unavailable", error);
    return Response.json({ error: "The database is not available." }, { status: 503 });
  }
}
