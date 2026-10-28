import { nextStep, type StoreDashboard } from "../../../lib/stores/dashboard";
import { StoreControls } from "./store-actions";

const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;

/** The seller's store page. Markup only; every number comes from `loadStoreDashboard`. */
export function StoreView({ data }: { data: StoreDashboard }) {
  const { store, listings, stats, ledger, claims, buttons } = data;
  const approved = listings.filter((l) => l.reviewStatus === "approved").length;
  return (
    <div className="space-y-8">
      <section aria-label="Store status">
        <h2 className="text-lg font-semibold">{store.name}</h2>
        <p className="text-sm text-muted">
          {store.published ? "Live" : "Not live yet"} at /shop/{store.slug}
        </p>
        <p className="mt-2 text-sm">{nextStep(store, approved)}</p>
        <StoreControls connected={Boolean(store.stripeConnectAccount)} verified={store.connectVerified} published={store.published} showPlatformBrand={store.showPlatformBrand} />
      </section>

      <section aria-label="Sales">
        <h2 className="text-lg font-semibold">Sales</h2>
        <p className="mt-1 text-sm text-muted">
          {stats.unitsSold} sold, {money(stats.grossCents)} in sales, {money(stats.royaltyCents)} earned, {money(stats.paidOutCents)} paid out, {money(stats.balanceCents)} owed to you.
        </p>
        <ul className="mt-3 space-y-2">
          {stats.listings.map((l) => (
            <li key={l.listingId} className="flex flex-wrap justify-between gap-2 rounded border border-line p-3 text-sm">
              <span>
                {l.title} <span className="text-muted">({l.reviewStatus}, {money(l.retailCents)})</span>
              </span>
              <span className="text-muted">
                {l.units} sold, {money(l.royaltyCents)} earned
              </span>
            </li>
          ))}
          {stats.listings.length === 0 && <li className="text-sm text-muted">No listings yet.</li>}
        </ul>
      </section>

      <section aria-label="Buy buttons">
        <h2 className="text-lg font-semibold">Buy buttons</h2>
        {buttons.length === 0 && <p className="mt-1 text-sm text-muted">Approved listings get a button you can paste on your own site.</p>}
        {buttons.map((b) => (
          <div key={b.listingId} className="mt-3">
            <p className="text-sm">{b.title}</p>
            <pre className="mt-1 overflow-x-auto rounded bg-sunken p-3 text-xs">{b.snippet}</pre>
          </div>
        ))}
      </section>

      <section aria-label="Payout history">
        <h2 className="text-lg font-semibold">Recent activity</h2>
        <ul className="mt-2 space-y-1 text-sm">
          {ledger.map((e) => (
            <li key={e.id} className="flex justify-between gap-2">
              <span className="text-muted">{e.kind}</span>
              <span>{money(e.amountCents)}</span>
            </li>
          ))}
          {ledger.length === 0 && <li className="text-muted">Nothing yet.</li>}
        </ul>
      </section>

      {claims.length > 0 && (
        <section aria-label="Takedown claims">
          <h2 className="text-lg font-semibold">Takedown claims</h2>
          <ul className="mt-2 space-y-2 text-sm">
            {claims.map((c) => (
              <li key={c.id} className="rounded border border-line p-3">
                <p>
                  {c.listingTitle}: {c.status}
                </p>
                <p className="text-muted">{c.workDescription}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
