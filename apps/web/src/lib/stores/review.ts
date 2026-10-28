import { and, asc, desc, eq } from "drizzle-orm";
import type { Db } from "../db/client";
import { designs, listings, stores } from "../db/schema";

export type Listing = typeof listings.$inferSelect;
export type ReviewResult = { ok: true; listing: Listing } | { ok: false; error: string; status: number };

export interface PendingListing {
  listing: Listing;
  storeName: string;
  storeSlug: string;
  designSafety: string;
}

/** Listings waiting for a decision, oldest first. */
export async function pendingListings(db: Db): Promise<PendingListing[]> {
  const rows = await db
    .select({ listing: listings, storeName: stores.name, storeSlug: stores.slug, designSafety: designs.safetyStatus })
    .from(listings)
    .innerJoin(stores, eq(stores.id, listings.storeId))
    .innerJoin(designs, eq(designs.id, listings.designId))
    .where(eq(listings.reviewStatus, "pending"))
    .orderBy(asc(listings.createdAt));
  return rows;
}

/**
 * An admin's decision on a pending listing (task B4.4a). To approve, the admin must confirm both checks the
 * plan asks for (not a copy of a factory part, no trademark), and the design must not be blocked by the safety
 * classifier. To reject, a reason is required; the seller sees it. Only pending listings can be decided.
 */
export async function reviewListing(
  db: Db,
  input: { listingId: string; adminId: string; decision: unknown; note?: unknown; checks?: { notFactoryCopy?: unknown; noTrademark?: unknown } },
): Promise<ReviewResult> {
  const [row] = await db
    .select({ listing: listings, safety: designs.safetyStatus })
    .from(listings)
    .innerJoin(designs, eq(designs.id, listings.designId))
    .where(eq(listings.id, input.listingId));
  if (!row) return { ok: false, error: "Listing not found.", status: 404 };
  if (row.listing.reviewStatus !== "pending") return { ok: false, error: `This listing was already ${row.listing.reviewStatus}.`, status: 409 };
  const note = typeof input.note === "string" ? input.note.trim().slice(0, 500) : "";
  let status: "approved" | "rejected";
  if (input.decision === "approve") {
    if (row.safety === "blocked") return { ok: false, error: "This design is blocked by the safety rules and cannot be approved.", status: 409 };
    if (input.checks?.notFactoryCopy !== true || input.checks?.noTrademark !== true) {
      return { ok: false, error: "Confirm both checks first: not a copy of a factory part, and no trademark.", status: 400 };
    }
    status = "approved";
  } else if (input.decision === "reject") {
    if (!note) return { ok: false, error: "Give the seller a reason for rejecting.", status: 400 };
    status = "rejected";
  } else {
    return { ok: false, error: "decision must be approve or reject.", status: 400 };
  }
  const [updated] = await db
    .update(listings)
    .set({ reviewStatus: status, reviewedBy: input.adminId, reviewedAt: new Date(), reviewNote: note || null })
    .where(and(eq(listings.id, input.listingId), eq(listings.reviewStatus, "pending")))
    .returning();
  if (!updated) return { ok: false, error: "This listing was just decided by someone else.", status: 409 };
  return { ok: true, listing: updated };
}

/** What a buyer may see on a store: only approved listings, and only when the store is published. */
export async function publicStore(db: Db, slug: string) {
  const [store] = await db.select().from(stores).where(and(eq(stores.slug, slug), eq(stores.published, true)));
  if (!store) return null;
  const items = await db
    .select({
      id: listings.id,
      title: listings.title,
      materialName: listings.materialName,
      retailCents: listings.retailCents,
      placeholder: listings.placeholder,
    })
    .from(listings)
    .where(and(eq(listings.storeId, store.id), eq(listings.reviewStatus, "approved")))
    .orderBy(desc(listings.createdAt));
  return { store: { name: store.name, slug: store.slug }, listings: items };
}
