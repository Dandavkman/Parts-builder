import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { createDesign, recorderFor } from "../agent/store";
import { runnerFor, type Db } from "../db/client";
import { migrate } from "../db/migrations";
import * as schema from "../db/schema";
import { buildQuotes } from "../quotes/engine";
import { saveQuotes } from "../quotes/store";
import { pendingListings, publicStore, reviewListing } from "./review";
import { createListing, createStore } from "./store";

describe("listing review", () => {
  let db: Db;
  beforeAll(async () => {
    db = drizzle(new PGlite(), { schema }) as unknown as Db;
    await migrate(runnerFor(db));
  });

  const spec = { spec_version: "1.1", features: [{ type: "plate", id: "a", thickness_mm: 3 }] };
  const ok = { notFactoryCopy: true, noTrademark: true };
  async function listed(owner: string, slug: string) {
    const store = await createStore(db, owner, "Shop", slug);
    if (!store.ok) throw new Error("store");
    const designId = await createDesign(db, owner, "Knob");
    await recorderFor(db, designId).version({ spec, ok: true, errors: [], createdBy: "agent", anchors: [] });
    const { quotes } = buildQuotes({ volume_mm3: 20_000, size_mm: [50, 40, 10], spec, quantity: 1 });
    const [quote] = await saveQuotes(db, designId, 1, quotes);
    const r = await createListing(db, { ownerId: owner, designId, quoteId: quote.id, retailCents: quote.totalCents + 500, title: "Knob" });
    if (!r.ok) throw new Error("listing");
    return { store: store.store, listing: r.listing, designId };
  }

  it("shows pending listings with their store, oldest first", async () => {
    const a = await listed("r1", "review-a");
    const queue = await pendingListings(db);
    expect(queue.map((q) => q.listing.id)).toContain(a.listing.id);
    expect(queue.find((q) => q.listing.id === a.listing.id)).toMatchObject({ storeSlug: "review-a", designSafety: "allowed" });
  });

  it("needs both checks to approve, then approves once", async () => {
    const { listing } = await listed("r2", "review-b");
    const base = { listingId: listing.id, adminId: "admin", decision: "approve" };
    expect(await reviewListing(db, base)).toMatchObject({ ok: false, status: 400 });
    expect(await reviewListing(db, { ...base, checks: { notFactoryCopy: true } })).toMatchObject({ ok: false, status: 400 });
    const done = await reviewListing(db, { ...base, checks: ok });
    expect(done.ok && done.listing).toMatchObject({ reviewStatus: "approved", reviewedBy: "admin" });
    expect(await reviewListing(db, { ...base, checks: ok })).toMatchObject({ ok: false, status: 409 });
  });

  it("needs a reason to reject and keeps it for the seller", async () => {
    const { listing } = await listed("r3", "review-c");
    expect(await reviewListing(db, { listingId: listing.id, adminId: "admin", decision: "reject" })).toMatchObject({ ok: false, status: 400 });
    const done = await reviewListing(db, { listingId: listing.id, adminId: "admin", decision: "reject", note: "Looks like a factory part." });
    expect(done.ok && done.listing).toMatchObject({ reviewStatus: "rejected", reviewNote: "Looks like a factory part." });
  });

  it("will not approve a blocked design, and rejects unknown decisions and listings", async () => {
    const { listing, designId } = await listed("r4", "review-d");
    await db.update(schema.designs).set({ safetyStatus: "blocked" }).where(eq(schema.designs.id, designId));
    expect(await reviewListing(db, { listingId: listing.id, adminId: "admin", decision: "approve", checks: ok })).toMatchObject({ ok: false, status: 409 });
    expect(await reviewListing(db, { listingId: listing.id, adminId: "admin", decision: "maybe" })).toMatchObject({ ok: false, status: 400 });
    expect(await reviewListing(db, { listingId: "00000000-0000-0000-0000-000000000000", adminId: "a", decision: "reject", note: "x" })).toMatchObject({ ok: false, status: 404 });
  });

  it("shows buyers only approved listings of a published store, without review details", async () => {
    const { store, listing } = await listed("r5", "review-e");
    await reviewListing(db, { listingId: listing.id, adminId: "admin", decision: "approve", checks: ok });
    expect(await publicStore(db, "review-e")).toBeNull();
    await db.update(schema.stores).set({ published: true }).where(eq(schema.stores.id, store.id));
    const shop = await publicStore(db, "review-e");
    expect(shop?.listings).toHaveLength(1);
    expect(JSON.stringify(shop)).not.toMatch(/reviewedBy|reviewNote|ownerId|floorCents|royaltyCents/);
    const pending = await listed("r6", "review-f");
    await db.update(schema.stores).set({ published: true }).where(eq(schema.stores.id, pending.store.id));
    expect((await publicStore(db, "review-f"))?.listings).toHaveLength(0);
    expect(await publicStore(db, "nope-nope")).toBeNull();
  });
});
