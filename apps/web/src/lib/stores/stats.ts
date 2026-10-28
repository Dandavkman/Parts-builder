import { eq } from "drizzle-orm";
import type { Db } from "../db/client";
import { ledgerEntries, listings } from "../db/schema";

export interface ListingStats {
  listingId: string;
  title: string;
  reviewStatus: string;
  retailCents: number;
  /** Units sold and not refunded. */
  units: number;
  refunds: number;
  /** Retail price times units. */
  grossCents: number;
  /** Royalty earned net of refunds. */
  royaltyCents: number;
}

export interface StoreStats {
  listings: ListingStats[];
  unitsSold: number;
  grossCents: number;
  royaltyCents: number;
  paidOutCents: number;
  balanceCents: number;
}

/**
 * Sales numbers for one store, computed from the append-only ledger so they always agree with what the seller
 * is owed. Every listing appears, with zeros when nothing sold.
 */
export async function storeStats(db: Db, storeId: string): Promise<StoreStats> {
  const [ls, entries] = await Promise.all([
    db.select().from(listings).where(eq(listings.storeId, storeId)),
    db.select().from(ledgerEntries).where(eq(ledgerEntries.storeId, storeId)),
  ]);
  const rows = new Map<string, ListingStats>(
    ls.map((l) => [l.id, { listingId: l.id, title: l.title, reviewStatus: l.reviewStatus, retailCents: l.retailCents, units: 0, refunds: 0, grossCents: 0, royaltyCents: 0 }]),
  );
  let paidOut = 0;
  let balance = 0;
  for (const e of entries) {
    balance += e.amountCents;
    if (e.kind === "payout") paidOut += -e.amountCents;
    const row = e.listingId ? rows.get(e.listingId) : undefined;
    if (!row) continue;
    if (e.kind === "royalty") row.units += 1;
    else if (e.kind === "refund") {
      row.units -= 1;
      row.refunds += 1;
    } else continue;
    row.royaltyCents += e.amountCents;
  }
  const list = [...rows.values()].map((r) => ({ ...r, grossCents: r.units * r.retailCents })).sort((a, b) => b.grossCents - a.grossCents || a.title.localeCompare(b.title));
  return {
    listings: list,
    unitsSold: list.reduce((n, r) => n + r.units, 0),
    grossCents: list.reduce((n, r) => n + r.grossCents, 0),
    royaltyCents: list.reduce((n, r) => n + r.royaltyCents, 0),
    paidOutCents: paidOut,
    balanceCents: balance,
  };
}
