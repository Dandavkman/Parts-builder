import type { Db } from "../db/client";
import { claimsForSeller } from "../takedowns/takedowns";
import { embedSnippet } from "./embed";
import { ledgerFor } from "./ledger";
import { storeStats } from "./stats";
import { getOwnedStore, listStoreListings } from "./store";

/** Everything the seller's store page shows, gathered in one place so the page itself is only markup. */
export async function loadStoreDashboard(db: Db, ownerId: string, origin: string) {
  const store = await getOwnedStore(db, ownerId);
  if (!store) return null;
  const [listings, stats, ledger, claims] = await Promise.all([
    listStoreListings(db, store.id),
    storeStats(db, store.id),
    ledgerFor(db, store.id, 20),
    claimsForSeller(db, ownerId),
  ]);
  const buttons = listings.filter((l) => l.reviewStatus === "approved").map((l) => ({ listingId: l.id, title: l.title, snippet: embedSnippet(origin, store.slug, l.id) }));
  return { store, listings, stats, ledger, claims, buttons };
}
export type StoreDashboard = NonNullable<Awaited<ReturnType<typeof loadStoreDashboard>>>;

/** The seller's next step, in plain words, from where the store stands. */
export function nextStep(store: { stripeConnectAccount: string | null; connectVerified: boolean; published: boolean }, approvedListings: number): string {
  if (!store.stripeConnectAccount) return "Set up payouts so we can pay you your royalties.";
  if (!store.connectVerified) return "Finish verifying your payout account with Stripe.";
  if (!store.published) return "Your account is verified. Publish your store to go live.";
  if (approvedListings === 0) return "Your store is live. List a design from the design page; it goes online after a quick review.";
  return "Your store is live. Paste a buy button on your own site to send buyers here.";
}
