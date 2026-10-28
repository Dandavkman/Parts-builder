import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { createDesign, recorderFor } from "../../../../../lib/agent/store";
import { runnerFor, type Db } from "../../../../../lib/db/client";
import { migrate } from "../../../../../lib/db/migrations";
import * as schema from "../../../../../lib/db/schema";
import { buildQuotes } from "../../../../../lib/quotes/engine";
import { saveQuotes } from "../../../../../lib/quotes/store";
import { createListing, createStore } from "../../../../../lib/stores/store";

/**
 * The whole buy flow in stub-payment mode, through the real route handlers: a buyer orders a store listing, the
 * order is paid, the seller is credited once, the seller's numbers and the packing slip agree. Only sign-in,
 * the database connection and the geometry service are replaced.
 */
const state = vi.hoisted(() => ({ db: null as unknown, user: "buyer", admin: true }));

vi.mock("../../../../../lib/db/client", async (importOriginal) => ({ ...(await importOriginal<typeof import("../../../../../lib/db/client")>()), getDb: async () => state.db }));
vi.mock("../../../../../lib/require-owner", () => ({ requireOwner: async () => ({ ownerId: state.user }) }));
vi.mock("../../../../../lib/require-admin", () => ({ requireAdmin: async () => (state.admin ? { adminId: "admin" } : { response: Response.json({ error: "no" }, { status: 403 }) }) }));
vi.mock("../../../../../lib/agent/geometry-client", () => ({ buildFile: async () => ({ ok: true, body: new ArrayBuffer(8) }) }));
vi.mock("../../../../../lib/agent/stl", () => ({
  stlBounds: () => ({ min: [0, 0, 0], max: [50, 40, 10] }),
  stlVolumeMm3: () => 20_000,
}));

const shipping = { name: "Ada", line1: "1 Main St", city: "Denver", region: "CO", postal_code: "80202", country: "US" };
const body = { shipping, email: "ada@example.com", confirmNotSafetyCritical: true, acceptFitTerms: true };
const post = (listingId: string, payload: unknown) =>
  import("./route").then(({ POST }) => POST(new Request("http://localhost/api/listings/x/order", { method: "POST", body: JSON.stringify(payload) }), { params: Promise.resolve({ id: listingId }) }));

describe("buy flow (stub payments)", () => {
  let db: Db;
  let listingId: string;
  let storeId: string;
  let royalty: number;

  beforeAll(async () => {
    vi.stubEnv("PAYMENTS_STUB", "1");
    db = drizzle(new PGlite(), { schema }) as unknown as Db;
    await migrate(runnerFor(db));
    state.db = db;
    const store = await createStore(db, "seller", "Knob Works", "knob-works");
    if (!store.ok) throw new Error("store");
    storeId = store.store.id;
    const spec = { spec_version: "1.1", features: [{ type: "plate", id: "a", thickness_mm: 3 }] };
    const designId = await createDesign(db, "seller", "Knob");
    await recorderFor(db, designId).version({ spec, ok: true, errors: [], createdBy: "agent", anchors: [] });
    const { quotes } = buildQuotes({ volume_mm3: 20_000, size_mm: [50, 40, 10], spec, quantity: 1 });
    const [quote] = await saveQuotes(db, designId, 1, quotes);
    const listed = await createListing(db, { ownerId: "seller", designId, quoteId: quote.id, retailCents: quote.totalCents + 1500, title: "Knob" });
    if (!listed.ok) throw new Error("listing");
    listingId = listed.listing.id;
    royalty = listed.listing.royaltyCents;
  });

  it("cannot be bought before the listing is approved and the store is live", async () => {
    expect((await post(listingId, body)).status).toBe(404);
    await db.update(schema.listings).set({ reviewStatus: "approved" }).where(eq(schema.listings.id, listingId));
    await db.update(schema.stores).set({ published: true, connectVerified: true }).where(eq(schema.stores.id, storeId));
  });

  it("refuses an order without both confirmations", async () => {
    expect((await post(listingId, { ...body, acceptFitTerms: false })).status).toBe(400);
  });

  it("places a paid order, credits the seller, and shows up in stats and the packing slip", async () => {
    const res = await post(listingId, body);
    expect(res.status).toBe(201);
    const { order } = (await res.json()) as { order: { id: string; status: string; listingId: string; totalCents: number } };
    expect(order).toMatchObject({ status: "paid", listingId });

    state.user = "seller";
    const { GET: stats } = await import("../../../stores/stats/route");
    const s = (await (await stats()).json()) as { unitsSold: number; royaltyCents: number; balanceCents: number; grossCents: number };
    expect(s).toMatchObject({ unitsSold: 1, royaltyCents: royalty, balanceCents: royalty, grossCents: order.totalCents });

    const { GET: slip } = await import("../../../admin/orders/[id]/packing-slip/route");
    const text = await (await slip(new Request("http://localhost/x"), { params: Promise.resolve({ id: order.id }) })).text();
    expect(text).toContain("Knob Works");
    expect(text).toContain("1 Main St");
    expect(text).not.toContain("Parts Builder");
  });

  it("credits one royalty per order, never twice", async () => {
    state.user = "buyer";
    expect((await post(listingId, body)).status).toBe(201);
    state.user = "seller";
    const { GET: stats } = await import("../../../stores/stats/route");
    const s = (await (await stats()).json()) as { unitsSold: number; balanceCents: number };
    expect(s).toMatchObject({ unitsSold: 2, balanceCents: 2 * royalty });
    expect((await db.select().from(schema.orders)).length).toBe(2);
  });

  it("stops selling once the listing is taken down", async () => {
    state.user = "buyer";
    await db.update(schema.listings).set({ reviewStatus: "removed" }).where(eq(schema.listings.id, listingId));
    expect((await post(listingId, body)).status).toBe(404);
  });
});
