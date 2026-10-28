import { viewerIsAdmin } from "../../../lib/admin/gate";
import { getDb } from "../../../lib/db/client";
import { claimQueue } from "../../../lib/takedowns/takedowns";
import { SiteHeader } from "../../site-header";
import { ClaimForm } from "./claim-form";

export const dynamic = "force-dynamic";

/** Takedown claims waiting for a decision, including counter-notices (admin). */
export default async function AdminTakedowns() {
  const allowed = await viewerIsAdmin();
  let queue: Awaited<ReturnType<typeof claimQueue>> = [];
  let problem: string | null = null;
  if (allowed) {
    try {
      queue = await claimQueue(await getDb());
    } catch {
      problem = "The database is not available.";
    }
  }
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="text-2xl font-semibold">Takedown claims (admin)</h1>
        {!allowed ? (
          <p className="mt-4 text-sm">Admins only.</p>
        ) : (
          <>
            {problem && <p className="mt-4 text-sm text-warning-text">{problem}</p>}
            {queue.length === 0 && !problem && <p className="mt-4 text-sm text-muted">Nothing waiting.</p>}
            <ul className="mt-4 space-y-4" aria-label="Claims">
              {queue.map(({ claim, listingTitle, storeName }) => (
                <li key={claim.id} className="rounded border border-line p-3 text-sm">
                  <p className="font-medium">
                    {listingTitle} <span className="font-normal text-muted">in {storeName} ({claim.status === "counter_filed" ? "counter-notice filed" : "new claim"})</span>
                  </p>
                  <p className="mt-1">From {claim.claimantName} ({claim.claimantEmail}): {claim.workDescription}</p>
                  {claim.counterText && <p className="mt-1 text-muted">Seller replied: {claim.counterText}</p>}
                  <ClaimForm claimId={claim.id} counter={claim.status === "counter_filed"} />
                </li>
              ))}
            </ul>
          </>
        )}
      </main>
    </>
  );
}
