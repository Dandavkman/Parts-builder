import { viewerIsAdmin } from "../../../lib/admin/gate";
import { getDb } from "../../../lib/db/client";
import { pendingListings } from "../../../lib/stores/review";
import { SiteHeader } from "../../site-header";
import { ReviewForm } from "./review-form";

export const dynamic = "force-dynamic";

/** Listings waiting for a person's decision (admin). */
export default async function AdminListings() {
  const allowed = await viewerIsAdmin();
  let pending: Awaited<ReturnType<typeof pendingListings>> = [];
  let problem: string | null = null;
  if (allowed) {
    try {
      pending = await pendingListings(await getDb());
    } catch {
      problem = "The database is not available.";
    }
  }
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="text-2xl font-semibold">Listings to review (admin)</h1>
        {!allowed ? (
          <p className="mt-4 text-sm">Admins only.</p>
        ) : (
          <>
            {problem && <p className="mt-4 text-sm text-warning-text">{problem}</p>}
            {pending.length === 0 && !problem && <p className="mt-4 text-sm text-muted">Nothing waiting.</p>}
            <ul className="mt-4 space-y-4" aria-label="Pending listings">
              {pending.map(({ listing, storeName, storeSlug, designSafety }) => (
                <li key={listing.id} className="rounded border border-line p-3 text-sm">
                  <p className="font-medium">
                    {listing.title} <span className="font-normal text-muted">in {listing.materialName}, ${(listing.retailCents / 100).toFixed(2)}</span>
                  </p>
                  <p className="text-muted">
                    Store {storeName} (/shop/{storeSlug}) · design safety: {designSafety}
                    {listing.placeholder ? " · placeholder pricing" : ""}
                  </p>
                  <ReviewForm listingId={listing.id} />
                </li>
              ))}
            </ul>
          </>
        )}
      </main>
    </>
  );
}
