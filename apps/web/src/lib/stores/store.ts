import { and, desc, eq } from "drizzle-orm";
import type { Db } from "../db/client";
import { designs, designVersions, listings, quotes, stores } from "../db/schema";
import { isReserved, splitRetail, STORE_FEES_ARE_PLACEHOLDER, validSlug } from "./royalty";

export type Store = typeof stores.$inferSelect;
export type Listing = typeof listings.$inferSelect;

export type CreateStoreResult = { ok: true; store: Store } | { ok: false; error: string };

export async function createStore(db: Db, ownerId: string, name: unknown, slug: unknown): Promise<CreateStoreResult> {
  const title = typeof name === "string" ? name.trim() : "";
  if (!title || title.length > 60) return { ok: false, error: "A store name of up to 60 characters is required." };
  if (!validSlug(slug)) return { ok: false, error: "The store address must be 3 to 30 lowercase letters, digits or hyphens." };
  if (isReserved(slug)) return { ok: false, error: "That store address is reserved." };
  const [mine] = await db.select().from(stores).where(eq(stores.ownerId, ownerId));
  if (mine) return { ok: false, error: "You already have a store." };
  const [taken] = await db.select({ id: stores.id }).from(stores).where(eq(stores.slug, slug));
  if (taken) return { ok: false, error: "That store address is taken." };
  const [store] = await db.insert(stores).values({ ownerId, slug, name: title }).returning();
  return { ok: true, store };
}

export async function getOwnedStore(db: Db, ownerId: string): Promise<Store | null> {
  const [row] = await db.select().from(stores).where(eq(stores.ownerId, ownerId));
  return row ?? null;
}

export async function listStoreListings(db: Db, storeId: string): Promise<Listing[]> {
  return db.select().from(listings).where(eq(listings.storeId, storeId)).orderBy(desc(listings.createdAt));
}

export type CreateListingResult = { ok: true; listing: Listing } | { ok: false; error: string; status: number };

/**
 * Lists a design version for sale in the owner's store. The quote (for one part) fixes the material and
 * the floor price; the retail price cannot be below it. New listings wait for review (B4.4), and a design
 * that is blocked cannot be listed.
 */
export async function createListing(
  db: Db,
  input: { ownerId: string; designId: string; quoteId: string; retailCents: unknown; title: unknown; now?: Date },
): Promise<CreateListingResult> {
  const now = input.now ?? new Date();
  const store = await getOwnedStore(db, input.ownerId);
  if (!store) return { ok: false, error: "Open a store first.", status: 409 };
  const [design] = await db.select().from(designs).where(and(eq(designs.id, input.designId), eq(designs.ownerId, input.ownerId)));
  if (!design) return { ok: false, error: "Design not found.", status: 404 };
  if (design.safetyStatus === "blocked") return { ok: false, error: "This design is in a category we do not sell.", status: 403 };
  const [quote] = await db.select().from(quotes).where(and(eq(quotes.id, input.quoteId), eq(quotes.designId, input.designId)));
  if (!quote) return { ok: false, error: "Quote not found.", status: 404 };
  if (quote.expiresAt <= now) return { ok: false, error: "That quote has expired. Get a new quote.", status: 409 };
  if (quote.quantity !== 1) return { ok: false, error: "Price a listing from a quote for one part.", status: 400 };
  const [version] = await db
    .select({ buildOk: designVersions.buildOk })
    .from(designVersions)
    .where(and(eq(designVersions.designId, input.designId), eq(designVersions.version, quote.version)));
  if (!version?.buildOk) return { ok: false, error: "That version of the design is not available.", status: 409 };
  const title = typeof input.title === "string" ? input.title.trim() : "";
  if (!title || title.length > 80) return { ok: false, error: "A listing title of up to 80 characters is required.", status: 400 };
  const split = splitRetail(quote.totalCents, input.retailCents as number);
  if ("error" in split) return { ok: false, error: split.error, status: 400 };
  const [listing] = await db
    .insert(listings)
    .values({
      storeId: store.id,
      designId: input.designId,
      version: quote.version,
      title,
      materialId: quote.materialId,
      materialName: quote.materialName,
      retailCents: split.retailCents,
      floorCents: split.floorCents,
      platformFeeCents: split.platformFeeCents,
      royaltyCents: split.royaltyCents,
      placeholder: quote.placeholder || STORE_FEES_ARE_PLACEHOLDER,
    })
    .returning();
  return { ok: true, listing };
}
