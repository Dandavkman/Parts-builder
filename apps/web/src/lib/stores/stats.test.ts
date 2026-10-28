import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { createDesign, recorderFor } from "../agent/store";
import { runnerFor, type Db } from "../db/client";
import { migrate } from "../db/migrations";
import * as schema from "../db/schema";
import { buildQuotes } from "../quotes/engine";
import { saveQuotes } from "../quotes/store";
import { recordPayout, recordRefund, recordSale } from "./ledger";
import { storeStats } from "./stats";
import { createListing, createStore } from "./store";

describe("store stats", () => {
  let db: Db;
  let storeId: string;
  let a: { id: string; royaltyCents: number; retailCents: number };
  let b: { id: string };

  beforeAll(async () => {
    db = drizzle(new PGlite(), { schema }) as unknown as Db;
    await migrate(runnerFor(db));
    const store = await createStore(db, "seller", "Shop", "stats-shop");
    if (!store.ok) throw new Error("store");
    storeId = store.store.id;
    const make = async (title: string, extra: number) => {
      const spec = { spec_version: "1.1", features: [{ type: "plate", id: "a", thickness_mm: 3 }] };
      const designId = await createDesign(db, "seller", title);
      await recorderFor(db, designId).version({ spec, ok: true, errors: [], createdBy: "agent", anchors: [] });
      const { quotes } = buildQuotes({ volume_mm3: 20_000, size_mm: [50, 40, 10], spec, quantity: 1 });
      const [q] = await saveQuotes(db, designId, 1, quotes);
      const r = await createListing(db, { ownerId: "seller", designId, quoteId: q.id, retailCents: q.totalCents + extra, title });
      if (!r.ok) throw new Error("listing");
      return r.listing;
    };
    a = await make("Knob", 1000);
    b = await make("Bracket", 500);
  });

  it("starts with every listing at zero", async () => {
    const s = await storeStats(db, storeId);
    expect(s.listings).toHaveLength(2);
    expect(s).toMatchObject({ unitsSold: 0, grossCents: 0, royaltyCents: 0, balanceCents: 0 });
  });

  it("counts sales and refunds per listing and agrees with the ledger balance", async () => {
    await recordSale(db, { listingId: a.id, ref: "o1" });
    await recordSale(db, { listingId: a.id, ref: "o2" });
    await recordSale(db, { listingId: b.id, ref: "o3" });
    await recordRefund(db, { listingId: a.id, ref: "o2" });
    await recordPayout(db, { storeId, amountCents: 1, ref: "p1", adminId: "admin" });
    const s = await storeStats(db, storeId);
    const knob = s.listings.find((l) => l.listingId === a.id)!;
    expect(knob).toMatchObject({ units: 1, refunds: 1, grossCents: a.retailCents, royaltyCents: a.royaltyCents });
    expect(s.unitsSold).toBe(2);
    expect(s.paidOutCents).toBe(1);
    expect(s.balanceCents).toBe(s.royaltyCents - 1);
    expect(s.listings[0].listingId).toBe(a.id);
  });
});
