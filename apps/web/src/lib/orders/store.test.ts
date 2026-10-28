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
import { getOwnedOrder, listAllOrders, listOwnedOrders, createOrder, markPaid, moveOrder } from "./store";

let db: Db;
beforeAll(async () => {
  db = drizzle(new PGlite(), { schema }) as unknown as Db;
  await migrate(runnerFor(db));
});

const spec = { spec_version: "1.1", features: [{ type: "plate", id: "a", thickness_mm: 3 }] };
const address = { name: "Ada", line1: "1 Main St", city: "Denver", region: "CO", postal_code: "80202", country: "US" };

async function setup(owner: string, safety?: string) {
  const designId = await createDesign(db, owner, "Bracket");
  await recorderFor(db, designId).version({ spec, ok: true, errors: [], createdBy: "agent", anchors: [] });
  if (safety) await db.update(schema.designs).set({ safetyStatus: safety }).where(eq(schema.designs.id, designId));
  const { quotes } = buildQuotes({ volume_mm3: 20_000, size_mm: [50, 40, 10], spec, quantity: 1 });
  const [quote] = await saveQuotes(db, designId, 1, quotes);
  return { designId, quote };
}

const confirmed = { confirmedNotSafetyCritical: true, acceptedFitTerms: true };

describe("orders", () => {
  it("creates an order that points at the exact version and copies the quote and spec", async () => {
    const { designId, quote } = await setup("o1");
    const r = await createOrder(db, { ownerId: "o1", designId, quoteId: quote.id, address, ...confirmed });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.order).toMatchObject({ status: "quote", version: 1, totalCents: quote.totalCents, quoteId: quote.id });
    expect(r.order.quoteSnapshot.totalCents).toBe(quote.totalCents);
    expect(r.order.specSnapshot).toEqual(spec);
    expect(r.order.safetyConfirmedAt).toBeInstanceOf(Date);
    expect(r.order.termsAcceptedAt).toBeInstanceOf(Date);
  });

  it("will not order without both confirmations", async () => {
    const { designId, quote } = await setup("o2");
    for (const flags of [
      { confirmedNotSafetyCritical: false, acceptedFitTerms: true },
      { confirmedNotSafetyCritical: true, acceptedFitTerms: false },
    ]) {
      expect(await createOrder(db, { ownerId: "o2", designId, quoteId: quote.id, address, ...flags })).toEqual({ ok: false, reason: "not_confirmed" });
    }
    expect(await listOwnedOrders(db, "o2")).toEqual([]);
  });

  it("refuses another user's design, an expired quote and a blocked design", async () => {
    const { designId, quote } = await setup("o3");
    expect(await createOrder(db, { ownerId: "intruder", designId, quoteId: quote.id, address, ...confirmed })).toEqual({ ok: false, reason: "design_not_found" });
    const later = new Date(quote.expiresAt.getTime() + 1000);
    expect(await createOrder(db, { ownerId: "o3", designId, quoteId: quote.id, address, ...confirmed, now: later })).toEqual({ ok: false, reason: "quote_expired" });
    const blocked = await setup("o3b", "blocked");
    expect(await createOrder(db, { ownerId: "o3b", designId: blocked.designId, quoteId: blocked.quote.id, address, ...confirmed })).toEqual({ ok: false, reason: "blocked" });
  });

  it("refuses a quote that belongs to a different design", async () => {
    const a = await setup("o4");
    const b = await setup("o4");
    expect(await createOrder(db, { ownerId: "o4", designId: a.designId, quoteId: b.quote.id, address, ...confirmed })).toEqual({ ok: false, reason: "quote_not_found" });
  });

  it("marks paid once, and a repeated payment changes nothing", async () => {
    const { designId, quote } = await setup("o5");
    const r = await createOrder(db, { ownerId: "o5", designId, quoteId: quote.id, address, ...confirmed });
    if (!r.ok) throw new Error("setup");
    const paid = await markPaid(db, r.order.id, { provider: "stub", ref: "pay_1" });
    expect(paid?.status).toBe("paid");
    const again = await markPaid(db, r.order.id, { provider: "stub", ref: "pay_2" });
    expect(again?.paymentRef).toBe("pay_1");
  });

  it("holds an order for a design that needs review", async () => {
    const { designId, quote } = await setup("o6", "needs_review");
    const r = await createOrder(db, { ownerId: "o6", designId, quoteId: quote.id, address, ...confirmed });
    if (!r.ok) throw new Error("setup");
    expect((await markPaid(db, r.order.id, { provider: "stub", ref: "pay_r" }))?.status).toBe("in_review");
  });

  it("moves along the allowed flow only, and keeps orders private", async () => {
    const { designId, quote } = await setup("o7");
    const r = await createOrder(db, { ownerId: "o7", designId, quoteId: quote.id, address, ...confirmed });
    if (!r.ok) throw new Error("setup");
    await markPaid(db, r.order.id, { provider: "stub", ref: "pay_m" });
    expect(await moveOrder(db, r.order.id, "shipped")).toEqual({ ok: false, reason: "not_allowed" });
    const sent = await moveOrder(db, r.order.id, "sent_to_partner", { partnerOrderRef: "P-1" });
    expect(sent.ok && sent.order.partnerOrderRef).toBe("P-1");
    expect(await moveOrder(db, "00000000-0000-0000-0000-000000000000", "paid")).toEqual({ ok: false, reason: "not_found" });
    expect(await getOwnedOrder(db, r.order.id, "someone_else")).toBeNull();
    expect((await getOwnedOrder(db, r.order.id, "o7"))?.id).toBe(r.order.id);
  });

  it("lists all orders for the admin, optionally by status", async () => {
    const { designId, quote } = await setup("o8");
    const r = await createOrder(db, { ownerId: "o8", designId, quoteId: quote.id, address, ...confirmed });
    if (!r.ok) throw new Error("setup");
    await markPaid(db, r.order.id, { provider: "stub", ref: "pay_all" });
    expect((await listAllOrders(db)).some((o) => o.id === r.order.id)).toBe(true);
    expect((await listAllOrders(db, "paid")).every((o) => o.status === "paid")).toBe(true);
    expect((await listAllOrders(db, "delivered")).some((o) => o.id === r.order.id)).toBe(false);
  });
});
