import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "../../../../lib/db/client";
import { publicStore } from "../../../../lib/stores/review";
import { PublicShell } from "../../../public-shell";

type Params = { params: Promise<{ slug: string; listing: string }> };

async function load({ params }: Params) {
  const { slug, listing } = await params;
  const shop = await publicStore(await getDb(), slug.toLowerCase().slice(0, 40)).catch(() => null);
  const item = shop?.listings.find((l) => l.id === listing);
  return shop && item ? { shop: shop.store, item } : null;
}

export async function generateMetadata(props: Params): Promise<Metadata> {
  const found = await load(props);
  return found ? { title: `${found.item.title} - ${found.shop.name}` } : { title: "Not found" };
}

export const dynamic = "force-dynamic";

/** The page a buy button opens: the item, its price, and the way to buy. */
export default async function ListingPage(props: Params) {
  const found = await load(props);
  if (!found) notFound();
  const { shop, item } = found;
  return (
    <PublicShell title={item.title}>
      <p className="mt-2 text-muted">from {shop.name}</p>
      <p className="mt-4">Made to order in {item.materialName}.</p>
      <p className="mt-2 text-2xl">${(item.retailCents / 100).toFixed(2)}</p>
      {item.placeholder && <p className="mt-4 rounded bg-warning-soft px-3 py-2 text-warning-ink">Example price only: pricing is not final yet.</p>}
      <p className="mt-6">
        <Link href="/sign-in" className="underline">
          Sign in to order
        </Link>
      </p>
    </PublicShell>
  );
}
