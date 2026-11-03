import { viewerIsAdmin } from "../../../lib/admin/gate";
import { getDb } from "../../../lib/db/client";
import { formatCents } from "../../../lib/quotes/engine";
import { storeBalances } from "../../../lib/stores/ledger";
import { SiteHeader } from "../../site-header";
import { PayoutForm } from "./payout-form";

export const dynamic = "force-dynamic";

/** What each seller is owed, and a form to record a payout after you send the money yourself (admin). */
export default async function AdminPayouts() {
  const allowed = await viewerIsAdmin();
  let rows: Awaited<ReturnType<typeof storeBalances>> = [];
  let problem: string | null = null;
  if (allowed) {
    try {
      rows = await storeBalances(await getDb());
    } catch {
      problem = "The database is not available.";
    }
  }
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="text-2xl font-semibold">Seller payouts (admin)</h1>
        {!allowed ? (
          <p className="mt-4 text-sm">Admins only.</p>
        ) : (
          <>
            <p className="mt-2 text-sm text-muted">Recording a payout does not move money. Send it from your bank first, then record the reference here.</p>
            {problem && <p className="mt-4 text-sm text-warning-text">{problem}</p>}
            {rows.length === 0 && !problem && <p className="mt-4 text-sm text-muted">No seller has earned anything yet.</p>}
            <ul className="mt-4 space-y-4" aria-label="Sellers">
              {rows.map((r) => (
                <li key={r.storeId} className="rounded border border-line p-3 text-sm">
                  <p className="font-medium">
                    {r.storeName} <span className="font-normal text-muted">/{r.slug}</span>
                  </p>
                  <p>
                    Owed {formatCents(r.balanceCents)}
                    {r.placeholder && <span className="text-muted"> (includes placeholder fees)</span>}
                  </p>
                  {r.balanceCents > 0 && <PayoutForm storeId={r.storeId} />}
                </li>
              ))}
            </ul>
          </>
        )}
      </main>
    </>
  );
}
