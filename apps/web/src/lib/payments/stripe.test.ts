import { PGlite } from "@electric-sql/pglite";
import { createHmac } from "node:crypto";
import { drizzle } from "drizzle-orm/pglite";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { createDesign, recorderFor } from "../agent/store";
import { runnerFor, type Db } from "../db/client";
import { migrate } from "../db/migrations";
import * as schema from "../db/schema";
import { createOrder, getOrder, type Order } from "../orders/store";
import { buildQuotes } from "../quotes/engine";
import { saveQuotes } from "../quotes/store";
import { getPaymentProvider } from "./provider";
import { formEncode, handleStripeEvent, stripeProvider, verifyStripeSignature } from "./stripe";

const sign = (body: string, secret: string, t: number) => `t=${t},v1=${createHmac("sha256", secret).update(`${t}.${body}`).digest("hex")}`;

describe("formEncode", () => {
  it("writes nested objects and arrays the way Stripe expects", () => {
    const out = formEncode({ mode: "payment", line_items: [{ quantity: 1, price_data: { currency: "usd" } }], metadata: { a: "x y" } });
    expect(out).toContain("mode=payment");
    expect(out).toContain("line_items%5B0%5D%5Bquantity%5D=1");
    expect(out).toContain("line_items%5B0%5D%5Bprice_data%5D%5Bcurrency%5D=usd");
    expect(out).toContain("metadata%5Ba%5D=x%20y");
  });
});

describe("verifyStripeSignature", () => {
  const body = '{"id":"evt_1"}';
  it("accepts a good signature and rejects tampering, wrong secrets, missing headers and old timestamps", () => {
    expect(verifyStripeSignature(body, sign(body, "whsec", 1000), "whsec", 1000)).toBe(true);
    expect(verifyStripeSignature(body + " ", sign(body, "whsec", 1000), "whsec", 1000)).toBe(false);
    expect(verifyStripeSignature(body, sign(body, "other", 1000), "whsec", 1000)).toBe(false);
    expect(verifyStripeSignature(body, null, "whsec", 1000)).toBe(false);
    expect(verifyStripeSignature(body, sign(body, "whsec", 1000), "whsec", 1000 + 301)).toBe(false);
    expect(verifyStripeSignature(body, "t=1000,v1=zz", "whsec", 1000)).toBe(false);
  });
});

const order = { id: "ord-1", totalCents: 4510, quoteSnapshot: { materialName: "PETG", quantity: 2, placeholder: true } } as unknown as Order;

describe("stripeProvider", () => {
  it("is absent without a key", () => {
    expect(stripeProvider({})).toBeNull();
  });

  it("creates a Checkout session for the order total and returns its URL", async () => {
    const doFetch = vi.fn(async () => new Response(JSON.stringify({ url: "https://checkout.stripe.com/c/1" }), { status: 200 }));
    const started = await stripeProvider({ STRIPE_SECRET_KEY: "sk_test_1" }, doFetch as unknown as typeof fetch)!.start(order, "https://app.test");
    expect(started).toEqual({ paidNow: false, url: "https://checkout.stripe.com/c/1" });
    const [url, init] = doFetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.stripe.com/v1/checkout/sessions");
    expect(String(init.body)).toContain("unit_amount%5D=4510");
    expect(String(init.body)).toContain("client_reference_id=ord-1");
    expect(String(init.body)).not.toContain("automatic_tax");
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer sk_test_1");
  });

  it("turns on Stripe Tax only when asked", async () => {
    const doFetch = vi.fn(async () => new Response(JSON.stringify({ url: "u" }), { status: 200 }));
    await stripeProvider({ STRIPE_SECRET_KEY: "sk_test_1", STRIPE_TAX: "1" }, doFetch as unknown as typeof fetch)!.start(order, "https://app.test");
    expect(String((doFetch.mock.calls[0] as unknown as [string, RequestInit])[1].body)).toContain("automatic_tax%5Benabled%5D=true");
  });

  it("refuses a live key for an order priced from placeholder rates", async () => {
    const doFetch = vi.fn();
    await expect(stripeProvider({ STRIPE_SECRET_KEY: "sk_live_1" }, doFetch as unknown as typeof fetch)!.start(order, "https://app.test")).rejects.toThrow(/placeholder/);
    expect(doFetch).not.toHaveBeenCalled();
  });

  it("is chosen over the stub when a key is set", () => {
    expect(getPaymentProvider({ NODE_ENV: "production", STRIPE_SECRET_KEY: "sk_test_1", PAYMENTS_STUB: "1" })?.name).toBe("stripe");
  });
});

describe("handleStripeEvent", () => {
  let db: Db;
  beforeAll(async () => {
    db = drizzle(new PGlite(), { schema }) as unknown as Db;
    await migrate(runnerFor(db));
  });

  async function pendingOrder() {
    const spec = { spec_version: "1.1", features: [{ type: "plate", id: "a", thickness_mm: 3 }] };
    const designId = await createDesign(db, "s1", "Part");
    await recorderFor(db, designId).version({ spec, ok: true, errors: [], createdBy: "agent", anchors: [] });
    const { quotes } = buildQuotes({ volume_mm3: 20_000, size_mm: [50, 40, 10], spec, quantity: 1 });
    const [quote] = await saveQuotes(db, designId, 1, quotes);
    const r = await createOrder(db, {
      ownerId: "s1", designId, quoteId: quote.id, confirmedNotSafetyCritical: true, acceptedFitTerms: true,
      address: { name: "A", line1: "1", city: "C", region: "R", postal_code: "1", country: "US" },
    });
    if (!r.ok) throw new Error("setup");
    return r.order;
  }

  it("marks the order paid on a completed, paid session, and a repeat changes nothing", async () => {
    const o = await pendingOrder();
    const event = { type: "checkout.session.completed", data: { object: { id: "cs_1", client_reference_id: o.id, payment_status: "paid", payment_intent: "pi_1" } } };
    expect(await handleStripeEvent(db, event)).toBe("paid");
    expect(await handleStripeEvent(db, event)).toBe("paid");
    const after = await getOrder(db, o.id);
    expect(after).toMatchObject({ status: "paid", paymentProvider: "stripe", paymentRef: "pi_1" });
  });

  it("ignores unpaid sessions, other events and unknown orders", async () => {
    const o = await pendingOrder();
    expect(await handleStripeEvent(db, { type: "checkout.session.completed", data: { object: { client_reference_id: o.id, payment_status: "unpaid" } } })).toBe("ignored");
    expect(await handleStripeEvent(db, { type: "charge.refunded", data: { object: {} } })).toBe("ignored");
    expect(await handleStripeEvent(db, { type: "checkout.session.completed", data: { object: { client_reference_id: "00000000-0000-0000-0000-000000000000", payment_status: "paid" } } })).toBe("ignored");
    expect((await getOrder(db, o.id))?.status).toBe("quote");
  });
});
