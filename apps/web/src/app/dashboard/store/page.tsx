import { getDb } from "../../../lib/db/client";
import { requireOwner } from "../../../lib/require-owner";
import { siteUrl } from "../../../lib/site";
import { loadStoreDashboard } from "../../../lib/stores/dashboard";
import { SiteHeader } from "../../site-header";
import { OpenStoreForm } from "./store-actions";
import { StoreView } from "./store-view";

export const dynamic = "force-dynamic";

/** The seller's store: status, sales, buy buttons and takedown claims. */
export default async function StorePage() {
  const who = await requireOwner();
  let body: React.ReactNode;
  if ("response" in who) {
    body = <p className="mt-4">Sign in to see your store.</p>;
  } else {
    try {
      const data = await loadStoreDashboard(await getDb(), who.ownerId, siteUrl());
      body = data ? (
        <StoreView data={data} />
      ) : (
        <>
          <p className="mt-2 text-sm text-muted">You do not have a store yet. Open one to sell your designs and earn a royalty on each sale.</p>
          <OpenStoreForm />
        </>
      );
    } catch {
      body = <p className="mt-4">The database is not available, so your store cannot be shown.</p>;
    }
  }
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="text-2xl font-semibold">My store</h1>
        {body}
      </main>
    </>
  );
}
