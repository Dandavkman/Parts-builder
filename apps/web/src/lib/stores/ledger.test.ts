import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { createDesign, recorderFor } from "../agent/store";
import { runnerFor, type Db } from "../db/client";
import { migrate } from "../db/migrations";
import * as schema from "../db/schema";
import { buildQuotes } from "../quotes/engine";
import { saveQuotes } from "../quotes/store";
import { balanceCents, ledgerFor, recordPayout, recordRefund, recordSale } from "./ledger";
import { createListing, createStore } from "./store";

describe("seller ledger", () => {
  let db: Db;
  let storeId: string;
  let listingId: string;
  let royalty: number;

  beforeAll(async () => {
    db = drizzle(new PGlite(), { schema }) as unknown as Db;
    await migrate(runnerFor(db));
    const store = await createStore(db, "seller", "Shop", "ledger-shop");
    if (!store.ok) throw new Error("store");
    storeId = store.store.id;
    const spec = { spec_version: "1.1", features: [{ type: "plate", id: "a", thickness_mm: 3 }] };
    const designId = await createDesign(db, "seller", "Knob");
    await recorderFor(db, designId).version({ spec, ok: true, errors: [], createdBy: "agent", anchors: [] });
    const { quotes } = buildQuotes({ volume_mm3: 20_000, size_mm: [50, 40, 10], spec, quantity: 1 });
    const [quote] = await saveQuotes(db, designId, 1, quotes);
    const listed = await createListing(db, { ownerId: "seller", designId, quoteId: quote.id, retailCents: quote.totalCents + 1000, title: "Knob" });
    if (!listed.ok) throw new Error("listing");
    listingId = listed.listing.id;
    royalty = listed.listing.royaltyCents;
  });

  it("credits the royalty once per sale, however often it is recorded", async () => {
    const first = await recordSale(db, { listingId, ref: "order-1" });
    expect(first).toMatchObject({ ok: true, duplicate: false });
    expect(await recordSale(db, { listingId, ref: "order-1" })).toMatchObject({ ok: true, duplicate: true });
    expect(await balanceCents(db, storeId)).toBe(royalty);
    await recordSale(db, { listingId, ref: "order-2" });
    expect(await balanceCents(db, storeId)).toBe(2 * royalty);
  });

  it("takes back a refunded sale once, and only if it was credited", async () => {
    expect(await recordRefund(db, { listingId, ref: "never" })).toMatchObject({ ok: false, status: 409 });
    expect(await recordRefund(db, { listingId, ref: "order-2" })).toMatchObject({ ok: true, duplicate: false });
    expect(await recordRefund(db, { listingId, ref: "order-2" })).toMatchObject({ ok: true, duplicate: true });
    expect(await balanceCents(db, storeId)).toBe(royalty);
  });

  it("pays out up to the balance, once per reference", async () => {
    const bad = { storeId, adminId: "admin" };
    expect(await recordPayout(db, { ...bad, amountCents: 0, ref: "p" })).toMatchObject({ ok: false, status: 400 });
    expect(await recordPayout(db, { ...bad, amountCents: 1.5, ref: "p" })).toMatchObject({ ok: false, status: 400 });
    expect(await recordPayout(db, { ...bad, amountCents: 100, ref: "" })).toMatchObject({ ok: false, status: 400 });
    expect(await recordPayout(db, { ...bad, amountCents: royalty + 1, ref: "p1" })).toMatchObject({ ok: false, status: 409 });
    expect(await recordPayout(db, { ...bad, amountCents: royalty - 1, ref: "p1" })).toMatchObject({ ok: true, duplicate: false });
    expect(await recordPayout(db, { ...bad, amountCents: royalty - 1, ref: "p1" })).toMatchObject({ ok: true, duplicate: true });
    expect(await balanceCents(db, storeId)).toBe(1);
  });

  it("lists entries newest first and refuses unknown listings", async () => {
    const entries = await ledgerFor(db, storeId);
    expect(entries.map((e) => e.kind)).toContain("payout");
    expect(entries.reduce((n, e) => n + e.amountCents, 0)).toBe(1);
    expect(await recordSale(db, { listingId: "00000000-0000-0000-0000-000000000000", ref: "x" })).toMatchObject({ ok: false, status: 404 });
  });
});
