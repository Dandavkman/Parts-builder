import Link from "next/link";
import { isAdmin } from "../../../lib/admin";
import { orderSummary, statusLabel } from "../../../lib/dashboard";
import { getDb } from "../../../lib/db/client";
import { isOrderStatus, nextStatuses, ORDER_STATUSES } from "../../../lib/orders/status";
import { listAllOrders } from "../../../lib/orders/store";
import { requireOwner } from "../../../lib/require-owner";
import { SiteHeader } from "../../site-header";
import { OrderActions } from "./order-actions";

export const dynamic = "force-dynamic";

export default async function AdminOrders({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;
  const who = await requireOwner();
  const allowed = !("response" in who) && isAdmin(who.ownerId);
  let orders: Awaited<ReturnType<typeof listAllOrders>> = [];
  let problem: string | null = null;
  if (allowed) {
    try {
      orders = await listAllOrders(await getDb(), isOrderStatus(status) ? status : undefined);
    } catch {
      problem = "The database is not available.";
    }
  }
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-4xl px-6 py-10">
        <h1 className="text-2xl font-semibold">Orders (admin)</h1>
        {!allowed ? (
          <p className="mt-4 text-sm">Admins only.</p>
        ) : (
          <>
            <nav className="mt-4 flex flex-wrap gap-3 text-sm" aria-label="Filter by status">
              <Link href="/admin/orders" className={status ? "underline" : "font-semibold"}>
                All
              </Link>
              {ORDER_STATUSES.map((s) => (
                <Link key={s} href={`/admin/orders?status=${s}`} className={status === s ? "font-semibold" : "underline"}>
                  {statusLabel(s)}
                </Link>
              ))}
            </nav>
            {problem && <p className="mt-4 text-sm text-warning-text">{problem}</p>}
            {orders.length === 0 && !problem && <p className="mt-4 text-sm text-muted">No orders.</p>}
            <ul className="mt-4 space-y-4" aria-label="Orders">
              {orders.map((o) => (
                <li key={o.id} className="rounded border border-line p-3 text-sm">
                  <div className="font-medium">
                    {orderSummary(o)} <span className="font-normal text-muted">({statusLabel(o.status)})</span>
                  </div>
                  <div className="text-muted">
                    {o.id} · {o.quoteSnapshot.partnerName} · {o.shippingAddress.name}, {o.shippingAddress.city} {o.shippingAddress.country}
                    {o.quoteSnapshot.placeholder ? " · placeholder pricing" : ""}
                  </div>
                  <div className="mt-1 flex gap-3 text-xs">
                    <a className="underline" href={`/api/admin/orders/${o.id}/job-sheet`}>
                      Job sheet
                    </a>
                    <a className="underline" href={`/api/admin/orders/${o.id}/file?format=step`}>
                      STEP
                    </a>
                    <a className="underline" href={`/api/admin/orders/${o.id}/file?format=stl`}>
                      STL
                    </a>
                  </div>
                  <OrderActions orderId={o.id} next={nextStatuses(o.status)} />
                </li>
              ))}
            </ul>
          </>
        )}
      </main>
    </>
  );
}
