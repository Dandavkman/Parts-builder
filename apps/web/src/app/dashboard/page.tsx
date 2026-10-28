import Link from "next/link";
import { listOwnedDesigns } from "../../lib/agent/store";
import { matches, orderSummary, orderText, statusLabel } from "../../lib/dashboard";
import { getDb } from "../../lib/db/client";
import { listOwnedOrders } from "../../lib/orders/store";
import { PLAN_LIMITS, plansEnforced, type Plan } from "../../lib/plans";
import { aiMessagesUsed, getPlan } from "../../lib/plans-store";
import { requireOwner } from "../../lib/require-owner";
import { SiteHeader } from "../site-header";

export const dynamic = "force-dynamic";

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const who = await requireOwner();
  let designs: Awaited<ReturnType<typeof listOwnedDesigns>> = [];
  let orders: Awaited<ReturnType<typeof listOwnedOrders>> = [];
  let problem: string | null = null;
  let usage: { plan: Plan; ai: number } | null = null;
  if ("response" in who) {
    problem = "Sign in to see your designs and orders.";
  } else {
    try {
      const db = await getDb();
      [designs, orders] = await Promise.all([listOwnedDesigns(db, who.ownerId), listOwnedOrders(db, who.ownerId)]);
      usage = { plan: await getPlan(db, who.ownerId), ai: await aiMessagesUsed(db, who.ownerId) };
    } catch {
      problem = "The database is not available, so your lists cannot be shown.";
    }
  }
  const shownDesigns = designs.filter((d) => matches(d.title, q));
  const shownOrders = orders.filter((o) => matches(orderText(o), q));

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-4xl px-6 py-10">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <form className="mt-4 flex gap-2" role="search">
          <input name="q" defaultValue={q ?? ""} aria-label="Search" placeholder="Search designs and orders" className="w-64 rounded border border-zinc-300 bg-transparent px-2 py-1 text-sm dark:border-zinc-700" />
          <button type="submit" className="rounded border border-zinc-300 px-3 py-1 text-sm dark:border-zinc-700">
            Search
          </button>
        </form>
        {usage && (
          <p className="mt-2 text-sm text-zinc-500">
            {usage.plan === "pro" ? "Pro plan" : "Free plan"}: {usage.ai} of {PLAN_LIMITS[usage.plan].aiMessagesPerMonth} AI messages used this month, {designs.length} of{" "}
            {PLAN_LIMITS[usage.plan].savedDesigns} designs saved{plansEnforced() ? "" : " (limits are not enforced yet)"}.
          </p>
        )}
        {problem && <p className="mt-4 text-sm text-amber-700">{problem}</p>}
        <div className="mt-8 grid gap-6 md:grid-cols-3">
          <section className="rounded border border-zinc-200 p-4 dark:border-zinc-800">
            <h2 className="font-medium">Scans</h2>
            <p className="mt-2 text-sm text-zinc-500">No scans yet. Upload a scan or choose one from the library.</p>
          </section>
          <section className="rounded border border-zinc-200 p-4 dark:border-zinc-800">
            <h2 className="font-medium">Designs ({shownDesigns.length})</h2>
            {shownDesigns.length === 0 ? (
              <p className="mt-2 text-sm text-zinc-500">{q ? "No designs match." : "No designs yet. Describe a part to start one."}</p>
            ) : (
              <ul className="mt-2 space-y-1 text-sm" aria-label="Designs">
                {shownDesigns.map((d) => (
                  <li key={d.id}>
                    <Link href={`/design?open=${d.id}`} className="underline">
                      {d.title}
                    </Link>
                    <span className="ml-2 text-zinc-500">{d.createdAt.toLocaleDateString("en-US")}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="rounded border border-zinc-200 p-4 dark:border-zinc-800">
            <h2 className="font-medium">Orders ({shownOrders.length})</h2>
            {shownOrders.length === 0 ? (
              <p className="mt-2 text-sm text-zinc-500">{q ? "No orders match." : "No orders yet."}</p>
            ) : (
              <ul className="mt-2 space-y-2 text-sm" aria-label="Orders">
                {shownOrders.map((o) => (
                  <li key={o.id}>
                    <div>{orderSummary(o)}</div>
                    <div className="text-zinc-500">
                      {statusLabel(o.status)}
                      {o.trackingNumber ? `, tracking ${o.trackingNumber}` : ""}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </main>
    </>
  );
}
