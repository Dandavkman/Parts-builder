import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { createDesign, recorderFor } from "../agent/store";
import { BRAND } from "../brand";
import { runnerFor, type Db } from "../db/client";
import { migrate } from "../db/migrations";
import * as schema from "../db/schema";
import { buildQuotes } from "../quotes/engine";
import { saveQuotes } from "../quotes/store";
import { createStoreOrder } from "../stores/checkout";
import { createListing, createStore } from "../stores/store";
import type { Message, Mailer } from "./mailer";
import { senderWithName } from "./mailer";
import { notifyOrder } from "./notify";
import { orderBrand } from "./order-brand";
import { renderPackingSlip } from "./packing-slip";

const address = { name: "Buyer", line1: "1 Main St", city: "Austin", region: "TX", postal_code: "78701", country: "US" };

describe("white-label emails and packing slips", () => {
  let db: Db;
  let storeId: string;
  let order: Awaited<ReturnType<typeof makeOrder>>;
  const sent: Message[] = [];
  const mailer: Mailer = { name: "capture", async send(m) { sent.push(m); } };

  async function makeOrder() {
    const spec = { spec_version: "1.1", features: [{ type: "plate", id: "a", thickness_mm: 3 }] };
    const designId = await createDesign(db, "seller", "Knob");
    await recorderFor(db, designId).version({ spec, ok: true, errors: [], createdBy: "agent", anchors: [] });
    const { quotes } = buildQuotes({ volume_mm3: 20_000, size_mm: [50, 40, 10], spec, quantity: 1 });
    const [quote] = await saveQuotes(db, designId, 1, quotes);
    const listed = await createListing(db, { ownerId: "seller", designId, quoteId: quote.id, retailCents: quote.totalCents + 1000, title: "Knob" });
    if (!listed.ok) throw new Error("listing");
    await db.update(schema.listings).set({ reviewStatus: "approved" }).where(eq(schema.listings.id, listed.listing.id));
    await db.update(schema.stores).set({ published: true, connectVerified: true }).where(eq(schema.stores.id, storeId));
    const made = await createStoreOrder(db, { buyerId: "buyer", listingId: listed.listing.id, line: quote as never, address, contactEmail: "buyer@example.com", confirmedNotSafetyCritical: true, acceptedFitTerms: true });
    if (!made.ok) throw new Error(made.reason);
    return made.order;
  }

  beforeAll(async () => {
    db = drizzle(new PGlite(), { schema }) as unknown as Db;
    await migrate(runnerFor(db));
    const store = await createStore(db, "seller", "Knob Works", "knob-works");
    if (!store.ok) throw new Error("store");
    storeId = store.store.id;
    order = await makeOrder();
  });

  it("shows the buyer the store, never our name, unless the seller turns it on", async () => {
    expect(await orderBrand(db, order)).toEqual({ name: "Knob Works", showPlatformBrand: false });
    expect(await notifyOrder(db, order, "order_confirmed", mailer)).toBe("sent");
    const mail = sent.at(-1)!;
    expect(mail.fromName).toBe("Knob Works");
    expect(mail.text).toContain("Knob Works");
    expect(`${mail.subject}\n${mail.text}`).not.toContain(BRAND.name);

    const slip = renderPackingSlip(order, await orderBrand(db, order));
    expect(slip).toContain("Knob Works");
    expect(slip).toContain("1 Main St");
    expect(slip).not.toContain(BRAND.name);
    expect(slip).not.toMatch(/\$\d/);

    await db.update(schema.stores).set({ showPlatformBrand: true }).where(eq(schema.stores.id, storeId));
    expect(await notifyOrder(db, order, "shipped", mailer)).toBe("sent");
    expect(sent.at(-1)!.text).toContain(`Made by ${BRAND.name}`);
    expect(renderPackingSlip(order, await orderBrand(db, order))).toContain(`Made by ${BRAND.name}`);
  });

  it("keeps our own orders in our own name", async () => {
    const own = { ...order, listingId: null };
    expect(await orderBrand(db, own)).toEqual({ showPlatformBrand: true });
    expect(renderPackingSlip(own, { showPlatformBrand: true })).toContain(BRAND.name);
  });

  it("puts the store name on the sender without breaking the address", () => {
    expect(senderWithName("Parts <hello@x.com>", "Knob Works")).toBe("Knob Works <hello@x.com>");
    expect(senderWithName("hello@x.com", 'Evil"\r\n <a@b>')).toBe("Evil a@b <hello@x.com>");
    expect(senderWithName("hello@x.com", undefined)).toBe("hello@x.com");
  });
});
