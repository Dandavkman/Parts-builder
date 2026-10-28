import { eq } from "drizzle-orm";
import type { Db } from "../db/client";
import { listings, stores } from "../db/schema";
import type { Order } from "../orders/store";

export interface OrderBrand {
  /** Store name for a store order; undefined for our own orders. */
  name?: string;
  showPlatformBrand: boolean;
}

/** Whose name goes on the buyer's emails and packing slip for this order. */
export async function orderBrand(db: Db, order: Pick<Order, "listingId">): Promise<OrderBrand> {
  if (!order.listingId) return { showPlatformBrand: true };
  const [row] = await db
    .select({ name: stores.name, show: stores.showPlatformBrand })
    .from(listings)
    .innerJoin(stores, eq(stores.id, listings.storeId))
    .where(eq(listings.id, order.listingId));
  return row ? { name: row.name, showPlatformBrand: row.show } : { showPlatformBrand: true };
}
