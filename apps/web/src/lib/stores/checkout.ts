import { and, eq } from "drizzle-orm";
import type { Db } from "../db/client";
import { designs, designVersions, listings, orders, stores } from "../db/schema";
import type { ShippingAddress } from "../orders/address";
import type { Order } from "../orders/store";
import type { QuoteLine } from "../quotes/engine";

export type StoreOrderResult =
  | { ok: true; order: Order }
  | { ok: false; reason: "not_found" | "not_for_sale" | "blocked" | "not_confirmed" | "wrong_material" | "price_changed" | "version_missing" };

/** What the buyer's order is made from: the listing's frozen version. Null when the listing or version is gone. */
export async function listingPart(db: Db, listingId: string) {
  const [row] = await db
    .select({ listing: listings, spec: designVersions.spec, anchors: designVersions.anchors, buildOk: designVersions.buildOk })
    .from(listings)
    .innerJoin(designVersions, and(eq(designVersions.designId, listings.designId), eq(designVersions.version, listings.version)))
    .where(eq(listings.id, listingId));
  return row ?? null;
}

/**
 * Creates an order in status `quote` for one unit of a listing. The buyer pays the listing's frozen retail price.
 * `line` is a fresh quote from the cheapest capable partner for the listing's material; if it now costs more than
 * the retail price the sale is refused, so a rate rise can never make us sell below cost. The order flows into the
 * normal fulfillment queue, and the seller's royalty is credited when it is paid (see `markPaid`).
 */
export async function createStoreOrder(
  db: Db,
  input: {
    buyerId: string;
    listingId: string;
    line: QuoteLine;
    address: ShippingAddress;
    contactEmail?: string;
    confirmedNotSafetyCritical: boolean;
    acceptedFitTerms: boolean;
    now?: Date;
  },
): Promise<StoreOrderResult> {
  const now = input.now ?? new Date();
  if (!input.confirmedNotSafetyCritical || !input.acceptedFitTerms) return { ok: false, reason: "not_confirmed" };
  const part = await listingPart(db, input.listingId);
  if (!part) return { ok: false, reason: "not_found" };
  const { listing } = part;
  const [store] = await db.select().from(stores).where(eq(stores.id, listing.storeId));
  if (!store || !store.published || !store.connectVerified || listing.reviewStatus !== "approved") return { ok: false, reason: "not_for_sale" };
  const [design] = await db.select().from(designs).where(eq(designs.id, listing.designId));
  if (!design || design.safetyStatus === "blocked") return { ok: false, reason: "blocked" };
  if (!part.buildOk) return { ok: false, reason: "version_missing" };
  if (input.line.materialId !== listing.materialId || input.line.quantity !== 1) return { ok: false, reason: "wrong_material" };
  if (input.line.totalCents > listing.retailCents) return { ok: false, reason: "price_changed" };
  const [order] = await db
    .insert(orders)
    .values({
      ownerId: input.buyerId,
      designId: listing.designId,
      version: listing.version,
      listingId: listing.id,
      quoteSnapshot: { ...input.line, totalCents: listing.retailCents },
      specSnapshot: part.spec,
      shippingAddress: input.address,
      contactEmail: input.contactEmail ?? null,
      totalCents: listing.retailCents,
      safetyConfirmedAt: now,
      termsAcceptedAt: now,
    })
    .returning();
  return { ok: true, order };
}
