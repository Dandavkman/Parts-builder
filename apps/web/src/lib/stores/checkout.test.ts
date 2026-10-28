import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { createDesign, recorderFor } from "../agent/store";
import { runnerFor, type Db } from "../db/client";
import { migrate } from "../db/migrations";
import * as schema from "../db/schema";
import { markPaid } from "../orders/store";
import { buildQuotes, type QuoteLine } from "../quotes/engine";
import { saveQuotes } from "../quotes/store";
import { createStoreOrder } from "./checkout";
import { balanceCents } from "./ledger";
import { createListing, createStore } from "./store";

const address = { name: "Buyer", line1: "1 Main St", city: "Austin", region: "TX", postal_code: "78701", country: "US" };
const ok = { confirmedNotSafetyCritical: true, acceptedFitTerms: true };

describe("store checkout", () => {
  let db: Db;
  let storeId: string;
  let listingId: string;
  let line: QuoteLine;
  let royalty: number;
  let retail: number;

  beforeAll(async () => {
    db = drizzle(new PGlite(), { schema }) as unknown as Db;
    await migrate(runnerFor(db));
    const store = await createStore(db, "seller", "Shop", "checkout-shop");
    if (!store.ok) throw new Error("store");
    storeId = store.store.id;
    const spec = { spec_version: "1.1", features: [{ type: "plate", id: "a", thickness_mm: 3 }] };
    const designId = await createDesign(db, "seller", "Knob");
    await recorderFor(db, designId).version({ spec, ok: true, errors: [], createdBy: "agent", anchors: [] });
    const { quotes } = buildQuotes({ volume_mm3: 20_000, size_mm: [50, 40, 10], spec, quantity: 1 });
    const [quote] = await saveQuotes(db, designId, 1, quotes);
    line = quote as unknown as QuoteLine;
    const listed = await createListing(db, { ownerId: "seller", designId, quoteId: quote.id, retailCents: quote.totalCents + 1000, title: "Knob" });
    if (!listed.ok) throw new Error("listing");
    listingId = listed.listing.id;
    royalty = listed.listing.royaltyCents;
    retail = listed.listing.retailCents;
  });

  const buy = (over: Partial<Parameters<typeof createStoreOrder>[1]> = {}) =>
    createStoreOrder(db, { buyerId: "buyer", listingId, line, address, ...ok, ...over });

  it("refuses a listing that is not approved or whose store is not live", async () => {
    expect(await buy()).toMatchObject({ ok: false, reason: "not_for_sale" });
    await db.update(schema.listings).set({ reviewStatus: "approved" }).where(eq(schema.listings.id, listingId));
    expect(await buy()).toMatchObject({ ok: false, reason: "not_for_sale" });
    await db.update(schema.stores).set({ published: true, connectVerified: true }).where(eq(schema.stores.id, storeId));
  });

  it("needs both confirmations, the listing's material, and a price that still covers the cost", async () => {
    expect(await buy({ acceptedFitTerms: false })).toMatchObject({ ok: false, reason: "not_confirmed" });
    expect(await buy({ line: { ...line, materialId: "other" } })).toMatchObject({ ok: false, reason: "wrong_material" });
    expect(await buy({ line: { ...line, totalCents: retail + 1 } })).toMatchObject({ ok: false, reason: "price_changed" });
    expect(await createStoreOrder(db, { buyerId: "b", listingId: "00000000-0000-4000-8000-000000000000", line, address, ...ok })).toMatchObject({ ok: false, reason: "not_found" });
  });

  it("makes one order at the retail price and credits the royalty once when it is paid", async () => {
    const made = await buy();
    if (!made.ok) throw new Error(made.reason);
    expect(made.order).toMatchObject({ ownerId: "buyer", listingId, status: "quote", totalCents: retail });
    expect(made.order.quoteSnapshot.partnerId).toBe(line.partnerId);
    expect(await balanceCents(db, storeId)).toBe(0);
    const paid = await markPaid(db, made.order.id, { provider: "stub", ref: "pay_1" });
    expect(paid?.status).toBe("paid");
    await markPaid(db, made.order.id, { provider: "stub", ref: "pay_1" });
    expect(await balanceCents(db, storeId)).toBe(royalty);
  });

  it("stops selling a listing that was taken down", async () => {
    await db.update(schema.listings).set({ reviewStatus: "removed" }).where(eq(schema.listings.id, listingId));
    expect(await buy()).toMatchObject({ ok: false, reason: "not_for_sale" });
  });
});
