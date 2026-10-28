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
import { storeActions } from "./actions";
import { loadStoreDashboard, nextStep } from "./dashboard";
import { recordSale } from "./ledger";
import { createListing, createStore } from "./store";

const reply = (status: number, body: unknown) => (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;

describe("seller store page data", () => {
  let db: Db;
  beforeAll(async () => {
    db = drizzle(new PGlite(), { schema }) as unknown as Db;
    await migrate(runnerFor(db));
  });

  it("is null until the seller opens a store", async () => {
    expect(await loadStoreDashboard(db, "seller", "https://site.example")).toBeNull();
  });

  it("gathers listings, numbers, ledger, takedown claims and buy buttons", async () => {
    const store = await createStore(db, "seller", "Shop", "page-shop");
    if (!store.ok) throw new Error("store");
    const spec = { spec_version: "1.1", features: [{ type: "plate", id: "a", thickness_mm: 3 }] };
    const designId = await createDesign(db, "seller", "Knob");
    await recorderFor(db, designId).version({ spec, ok: true, errors: [], createdBy: "agent", anchors: [] });
    const { quotes } = buildQuotes({ volume_mm3: 20_000, size_mm: [50, 40, 10], spec, quantity: 1 });
    const [quote] = await saveQuotes(db, designId, 1, quotes);
    const listed = await createListing(db, { ownerId: "seller", designId, quoteId: quote.id, retailCents: quote.totalCents + 1000, title: "Knob" });
    if (!listed.ok) throw new Error("listing");
    let data = await loadStoreDashboard(db, "seller", "https://site.example");
    expect(data?.buttons).toEqual([]);
    await db.update(schema.listings).set({ reviewStatus: "approved" }).where(eq(schema.listings.id, listed.listing.id));
    await recordSale(db, { listingId: listed.listing.id, ref: "o1" });
    data = await loadStoreDashboard(db, "seller", "https://site.example");
    expect(data?.listings).toHaveLength(1);
    expect(data?.stats.unitsSold).toBe(1);
    expect(data?.ledger).toHaveLength(1);
    expect(data?.buttons[0].snippet).toContain('data-store="page-shop"');
    expect(data?.claims).toEqual([]);
  });

  it("names the seller's next step", () => {
    const s = { stripeConnectAccount: null as string | null, connectVerified: false, published: false };
    expect(nextStep(s, 0)).toContain("payouts");
    expect(nextStep({ ...s, stripeConnectAccount: "acct" }, 0)).toContain("verifying");
    expect(nextStep({ ...s, stripeConnectAccount: "acct", connectVerified: true }, 0)).toContain("Publish");
    expect(nextStep({ stripeConnectAccount: "acct", connectVerified: true, published: true }, 0)).toContain("List a design");
    expect(nextStep({ stripeConnectAccount: "acct", connectVerified: true, published: true }, 2)).toContain("buy button");
  });
});

describe("store actions", () => {
  it("returns data on success and one plain sentence on failure", async () => {
    expect(await storeActions.connect(reply(200, { url: "https://stripe.example/x" }))).toEqual({ ok: true, data: { url: "https://stripe.example/x" } });
    expect(await storeActions.publish(reply(409, { error: "Stripe has not finished verifying your account yet." }))).toEqual({ ok: false, error: "Stripe has not finished verifying your account yet." });
    expect(await storeActions.open("Shop", "x", reply(500, {}))).toEqual({ ok: false, error: "That did not work. Please try again." });
    expect(await storeActions.setPlatformBrand(true, (async () => { throw new Error("offline"); }) as unknown as typeof fetch)).toMatchObject({ ok: false });
  });
});
