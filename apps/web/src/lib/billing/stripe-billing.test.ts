import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { runnerFor, type Db } from "../db/client";
import { migrate } from "../db/migrations";
import * as schema from "../db/schema";
import { getPlan, getStripeCustomerId } from "../plans-store";
import { billingProvider, handleBillingEvent } from "./stripe-billing";

const ENV = { STRIPE_SECRET_KEY: "sk_test_x", STRIPE_PRO_PRICE_ID: "price_123" };
const okFetch = () => vi.fn().mockResolvedValue(new Response(JSON.stringify({ url: "https://stripe.test/pay" }), { status: 200 }));

describe("billingProvider", () => {
  it("is off without a key or a price", () => {
    expect(billingProvider({})).toBeNull();
    expect(billingProvider({ STRIPE_SECRET_KEY: "sk_test_x" })).toBeNull();
    expect(billingProvider({ STRIPE_PRO_PRICE_ID: "price_1" })).toBeNull();
  });

  it("starts a subscription checkout tagged with the user", async () => {
    const f = okFetch();
    const url = await billingProvider(ENV, f as unknown as typeof fetch)!.startPro("user_1", "https://app.test", "cus_9");
    expect(url).toBe("https://stripe.test/pay");
    const [endpoint, init] = f.mock.calls[0];
    expect(endpoint).toBe("https://api.stripe.com/v1/checkout/sessions");
    const body = decodeURIComponent(init.body as string);
    expect(body).toContain("mode=subscription");
    expect(body).toContain("client_reference_id=user_1");
    expect(body).toContain("customer=cus_9");
    expect(body).toContain("line_items[0][price]=price_123");
    expect(body).toContain("subscription_data[metadata][owner_id]=user_1");
  });

  it("refuses a live key until the price is confirmed", () => {
    const live = { ...ENV, STRIPE_SECRET_KEY: "sk_live_x" };
    expect(() => billingProvider(live, okFetch() as unknown as typeof fetch)!.startPro("u", "https://a", null)).toThrow(/PRO_PRICE_CONFIRMED/);
    expect(() => billingProvider({ ...live, PRO_PRICE_CONFIRMED: "1" }, okFetch() as unknown as typeof fetch)!.startPro("u", "https://a", null)).not.toThrow();
  });

  it("opens the customer portal and reports Stripe errors", async () => {
    expect(await billingProvider(ENV, okFetch() as unknown as typeof fetch)!.openPortal("cus_1", "https://a")).toBe("https://stripe.test/pay");
    const bad = vi.fn().mockResolvedValue(new Response("{}", { status: 402 }));
    await expect(billingProvider(ENV, bad as unknown as typeof fetch)!.openPortal("cus_1", "https://a")).rejects.toThrow("402");
  });
});

describe("handleBillingEvent", () => {
  let db: Db;
  beforeAll(async () => {
    db = drizzle(new PGlite(), { schema }) as unknown as Db;
    await migrate(runnerFor(db));
  });

  const completed = { type: "checkout.session.completed", data: { object: { mode: "subscription", client_reference_id: "u1", customer: "cus_1", subscription: "sub_1" } } };

  it("makes the user Pro and remembers the Stripe ids, even if the event repeats", async () => {
    expect(await handleBillingEvent(db, completed)).toBe("upgraded");
    expect(await handleBillingEvent(db, completed)).toBe("upgraded");
    expect(await getPlan(db, "u1")).toBe("pro");
    expect(await getStripeCustomerId(db, "u1")).toBe("cus_1");
  });

  it("moves between Pro and Free as the subscription changes", async () => {
    expect(await handleBillingEvent(db, { type: "customer.subscription.updated", data: { object: { id: "sub_1", status: "past_due" } } })).toBe("downgraded");
    expect(await getPlan(db, "u1")).toBe("free");
    expect(await handleBillingEvent(db, { type: "customer.subscription.updated", data: { object: { id: "sub_1", status: "active" } } })).toBe("upgraded");
    expect(await getPlan(db, "u1")).toBe("pro");
    expect(await handleBillingEvent(db, { type: "customer.subscription.deleted", data: { object: { id: "sub_1", status: "canceled" } } })).toBe("downgraded");
    expect(await getPlan(db, "u1")).toBe("free");
  });

  it("ignores payment-mode checkouts, unknown events and unknown subscriptions", async () => {
    expect(await handleBillingEvent(db, { type: "checkout.session.completed", data: { object: { mode: "payment", client_reference_id: "u2" } } })).toBe("ignored");
    expect(await handleBillingEvent(db, { type: "invoice.paid", data: { object: {} } })).toBe("ignored");
    expect(await handleBillingEvent(db, { type: "customer.subscription.deleted", data: { object: { id: "sub_unknown" } } })).toBe("ignored");
    expect(await getPlan(db, "u2")).toBe("free");
  });
});
