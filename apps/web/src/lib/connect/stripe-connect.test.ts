import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { runnerFor, type Db } from "../db/client";
import { migrate } from "../db/migrations";
import * as schema from "../db/schema";
import { createStore, getOwnedStore } from "../stores/store";
import { connectProvider, handleConnectEvent, publishStore, startOnboarding, type ConnectProvider } from "./stripe-connect";

const ENV = { STRIPE_SECRET_KEY: "sk_test_x", STRIPE_CONNECT: "1" };
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

describe("connectProvider", () => {
  it("is off unless STRIPE_CONNECT=1 and a key is set", () => {
    expect(connectProvider({})).toBeNull();
    expect(connectProvider({ STRIPE_SECRET_KEY: "sk_test_x" })).toBeNull();
    expect(connectProvider({ STRIPE_CONNECT: "1" })).toBeNull();
  });

  it("refuses a live key until the terms are confirmed", () => {
    expect(() => connectProvider({ ...ENV, STRIPE_SECRET_KEY: "sk_live_x" })).toThrow(/CONNECT_TERMS_CONFIRMED/);
    expect(connectProvider({ ...ENV, STRIPE_SECRET_KEY: "sk_live_x", CONNECT_TERMS_CONFIRMED: "1" })).not.toBeNull();
  });

  it("creates an Express account, a link, and reads status", async () => {
    const f = vi
      .fn()
      .mockResolvedValueOnce(reply({ id: "acct_1" }))
      .mockResolvedValueOnce(reply({ url: "https://connect.test/go" }))
      .mockResolvedValueOnce(reply({ details_submitted: true, payouts_enabled: false }));
    const p = connectProvider(ENV, f as unknown as typeof fetch)!;
    expect(await p.createAccount({ id: "s1", name: "Shop" })).toBe("acct_1");
    expect(decodeURIComponent(f.mock.calls[0][1].body as string)).toContain("type=express");
    expect(await p.onboardingUrl("acct_1", "https://app.test")).toBe("https://connect.test/go");
    expect(decodeURIComponent(f.mock.calls[1][1].body as string)).toContain("type=account_onboarding");
    expect(await p.status("acct_1")).toEqual({ detailsSubmitted: true, payoutsEnabled: false });
  });

  it("reports a Stripe error", async () => {
    const p = connectProvider(ENV, vi.fn().mockResolvedValue(reply({}, 400)) as unknown as typeof fetch)!;
    await expect(p.status("acct_1")).rejects.toThrow("400");
  });
});

describe("seller verification and publishing", () => {
  let db: Db;
  beforeAll(async () => {
    db = drizzle(new PGlite(), { schema }) as unknown as Db;
    await migrate(runnerFor(db));
  });

  const fake = (status = { detailsSubmitted: true, payoutsEnabled: true }): ConnectProvider => ({
    createAccount: vi.fn().mockResolvedValue("acct_A"),
    onboardingUrl: vi.fn().mockResolvedValue("https://connect.test/go"),
    status: vi.fn().mockResolvedValue(status),
  });
  async function open(owner: string, slug: string) {
    const r = await createStore(db, owner, "Shop", slug);
    if (!r.ok) throw new Error("store");
    return r.store;
  }

  it("makes the Stripe account once and remembers it", async () => {
    const store = await open("o1", "shop-one");
    const p = fake();
    expect(await startOnboarding(db, p, store, "https://app.test")).toBe("https://connect.test/go");
    const again = (await getOwnedStore(db, "o1"))!;
    expect(again.stripeConnectAccount).toBe("acct_A");
    await startOnboarding(db, p, again, "https://app.test");
    expect(p.createAccount).toHaveBeenCalledTimes(1);
  });

  it("will not publish before Stripe verifies, then publishes", async () => {
    const store = await open("o2", "shop-two");
    expect(await publishStore(db, fake(), store)).toMatchObject({ ok: false, status: 409, error: "Connect your payout account first." });
    await startOnboarding(db, fake(), store, "https://app.test");
    const withAccount = (await getOwnedStore(db, "o2"))!;
    expect(await publishStore(db, fake({ detailsSubmitted: true, payoutsEnabled: false }), withAccount)).toMatchObject({ ok: false, status: 409 });
    const done = await publishStore(db, fake(), withAccount);
    expect(done.ok && done.store.published && done.store.connectVerified).toBe(true);
  });

  it("refuses when Connect is off or there is no store", async () => {
    expect(await publishStore(db, fake(), null)).toMatchObject({ ok: false, status: 409 });
    expect(await publishStore(db, null, await open("o3", "shop-three"))).toMatchObject({ ok: false, status: 503 });
  });

  it("takes a store offline when Stripe says payouts stopped, and ignores other events", async () => {
    const store = (await getOwnedStore(db, "o2"))!;
    const acct = store.stripeConnectAccount!;
    expect(await handleConnectEvent(db, { type: "account.updated", data: { object: { id: acct, details_submitted: true, payouts_enabled: false } } })).toBe("updated");
    const [row] = await db.select().from(schema.stores).where(eq(schema.stores.id, store.id));
    expect(row.published).toBe(false);
    expect(row.connectVerified).toBe(false);
    expect(await handleConnectEvent(db, { type: "account.updated", data: { object: { id: "acct_unknown" } } })).toBe("ignored");
    expect(await handleConnectEvent(db, { type: "invoice.paid", data: { object: { id: acct } } })).toBe("ignored");
  });
});
