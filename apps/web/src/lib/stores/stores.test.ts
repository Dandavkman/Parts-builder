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
import { splitRetail, validSlug } from "./royalty";
import { createListing, createStore, getOwnedStore, listStoreListings } from "./store";

describe("splitRetail", () => {
  it("gives the seller the margin above the floor minus the platform's share", () => {
    expect(splitRetail(2000, 3000, 20)).toEqual({ floorCents: 2000, retailCents: 3000, platformFeeCents: 200, royaltyCents: 800 });
  });

  it("allows a price exactly at the floor (no royalty) and refuses below it", () => {
    expect(splitRetail(2000, 2000, 20)).toEqual({ floorCents: 2000, retailCents: 2000, platformFeeCents: 0, royaltyCents: 0 });
    expect(splitRetail(2000, 1999, 20)).toHaveProperty("error");
  });

  it("refuses prices that are not whole positive cents", () => {
    for (const bad of [0, -5, 10.5, Number.NaN]) expect(splitRetail(0, bad)).toHaveProperty("error");
  });

  it("always adds up to the price above the floor", () => {
    for (const retail of [2001, 2333, 9999, 123456]) {
      const s = splitRetail(2000, retail, 20) as Exclude<ReturnType<typeof splitRetail>, { error: string }>;
      expect(s.platformFeeCents + s.royaltyCents).toBe(retail - 2000);
    }
  });
});

describe("validSlug", () => {
  it("accepts lowercase words with single inner hyphens", () => {
    for (const ok of ["abc", "miata-parts", "shop42"]) expect(validSlug(ok)).toBe(true);
  });
  it("rejects short, long, uppercase, edge or double hyphens and non-strings", () => {
    for (const bad of ["ab", "-abc", "abc-", "a--b", "ABC", "a b", "x".repeat(31), 5, null]) expect(validSlug(bad)).toBe(false);
  });
});

describe("stores and listings", () => {
  let db: Db;
  beforeAll(async () => {
    db = drizzle(new PGlite(), { schema }) as unknown as Db;
    await migrate(runnerFor(db));
  });

  const spec = { spec_version: "1.1", features: [{ type: "plate", id: "a", thickness_mm: 3 }] };
  async function design(owner: string, qty = 1, safety?: string) {
    const designId = await createDesign(db, owner, "Knob");
    await recorderFor(db, designId).version({ spec, ok: true, errors: [], createdBy: "agent", anchors: [] });
    if (safety) await db.update(schema.designs).set({ safetyStatus: safety }).where(eq(schema.designs.id, designId));
    const { quotes } = buildQuotes({ volume_mm3: 20_000, size_mm: [50, 40, 10], spec, quantity: qty });
    const [quote] = await saveQuotes(db, designId, 1, quotes);
    return { designId, quote };
  }

  it("opens one unpublished store per user, with a unique address", async () => {
    const a = await createStore(db, "s1", "Knob Shop", "knob-shop");
    expect(a.ok && a.store.published).toBe(false);
    expect(await createStore(db, "s1", "Again", "other-name")).toMatchObject({ ok: false });
    expect(await createStore(db, "s2", "Copy", "knob-shop")).toMatchObject({ ok: false, error: "That store address is taken." });
    expect(await createStore(db, "s3", "Admin", "admin")).toMatchObject({ ok: false });
    expect(await createStore(db, "s4", "", "good-slug")).toMatchObject({ ok: false });
  });

  it("lists a design at or above the floor, pending review, with the split stored", async () => {
    await createStore(db, "l1", "Shop", "shop-l1");
    const { designId, quote } = await design("l1");
    const r = await createListing(db, { ownerId: "l1", designId, quoteId: quote.id, retailCents: quote.totalCents + 1000, title: "Knob" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.listing).toMatchObject({ reviewStatus: "pending", floorCents: quote.totalCents, platformFeeCents: 200, royaltyCents: 800, placeholder: true });
    const store = await getOwnedStore(db, "l1");
    expect((await listStoreListings(db, store!.id)).map((l) => l.id)).toEqual([r.listing.id]);
  });

  it("refuses prices under the floor, expired quotes, multi-part quotes, blocked designs and other people's designs", async () => {
    await createStore(db, "l2", "Shop", "shop-l2");
    const { designId, quote } = await design("l2");
    expect(await createListing(db, { ownerId: "l2", designId, quoteId: quote.id, retailCents: quote.totalCents - 1, title: "x" })).toMatchObject({ ok: false, status: 400 });
    expect(await createListing(db, { ownerId: "l2", designId, quoteId: quote.id, retailCents: quote.totalCents + 5, title: "x", now: new Date(quote.expiresAt.getTime() + 1) })).toMatchObject({ ok: false, status: 409 });
    const many = await design("l2", 3);
    expect(await createListing(db, { ownerId: "l2", designId: many.designId, quoteId: many.quote.id, retailCents: many.quote.totalCents + 5, title: "x" })).toMatchObject({ ok: false, status: 400 });
    const blocked = await design("l2", 1, "blocked");
    expect(await createListing(db, { ownerId: "l2", designId: blocked.designId, quoteId: blocked.quote.id, retailCents: blocked.quote.totalCents + 5, title: "x" })).toMatchObject({ ok: false, status: 403 });
    expect(await createListing(db, { ownerId: "intruder-with-store", designId, quoteId: quote.id, retailCents: quote.totalCents + 5, title: "x" })).toMatchObject({ ok: false, status: 409 });
    await createStore(db, "intruder", "Shop", "shop-int");
    expect(await createListing(db, { ownerId: "intruder", designId, quoteId: quote.id, retailCents: quote.totalCents + 5, title: "x" })).toMatchObject({ ok: false, status: 404 });
  });

  it("needs a store before listing", async () => {
    const { designId, quote } = await design("nostore");
    expect(await createListing(db, { ownerId: "nostore", designId, quoteId: quote.id, retailCents: quote.totalCents + 5, title: "x" })).toMatchObject({ ok: false, status: 409 });
  });
});
