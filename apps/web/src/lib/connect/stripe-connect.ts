import { eq } from "drizzle-orm";
import type { Db } from "../db/client";
import { stores } from "../db/schema";
import { formEncode } from "../payments/stripe";
import type { Store } from "../stores/store";

type Env = Record<string, string | undefined>;
type Fetch = typeof fetch;

export interface AccountStatus {
  detailsSubmitted: boolean;
  payoutsEnabled: boolean;
}

export interface ConnectProvider {
  createAccount(store: Pick<Store, "id" | "name">): Promise<string>;
  onboardingUrl(accountId: string, origin: string): Promise<string>;
  status(accountId: string): Promise<AccountStatus>;
}

/** A seller counts as verified once Stripe has their details and can pay them out. */
export const isVerified = (s: AccountStatus) => s.detailsSubmitted && s.payoutsEnabled;

/**
 * Stripe Connect Express through the REST API (no SDK). On only when STRIPE_CONNECT=1 and a Stripe key is
 * set; use a test key (`sk_test_`) first, which makes test accounts only. A live key is refused until the
 * Owner confirms the platform fee and payout rules (O4.2) with CONNECT_TERMS_CONFIRMED=1.
 */
export function connectProvider(env: Env = process.env, doFetch: Fetch = fetch): ConnectProvider | null {
  const key = env.STRIPE_SECRET_KEY;
  if (env.STRIPE_CONNECT !== "1" || !key) return null;
  if (key.startsWith("sk_live_") && env.CONNECT_TERMS_CONFIRMED !== "1") {
    throw new Error("Live Connect is refused until CONNECT_TERMS_CONFIRMED=1.");
  }
  const call = async (method: "GET" | "POST", path: string, body?: Record<string, unknown>, idempotencyKey?: string) => {
    const response = await doFetch(`https://api.stripe.com/v1/${path}`, {
      method,
      headers: { authorization: `Bearer ${key}`, ...(body ? { "content-type": "application/x-www-form-urlencoded" } : {}), ...(idempotencyKey ? { "idempotency-key": idempotencyKey } : {}) },
      body: body ? formEncode(body).join("&") : undefined,
    });
    const data = (await response.json().catch(() => null)) as Record<string, unknown> | null;
    if (!response.ok || !data) throw new Error(`Stripe returned ${response.status}.`);
    return data;
  };
  return {
    async createAccount(store) {
      const data = await call("POST", "accounts", { type: "express", metadata: { store_id: store.id }, business_profile: { name: store.name } }, `connect_account_${store.id}`);
      if (typeof data.id !== "string") throw new Error("Stripe sent no account id.");
      return data.id;
    },
    async onboardingUrl(accountId, origin) {
      const data = await call("POST", "account_links", { account: accountId, type: "account_onboarding", refresh_url: `${origin}/dashboard?connect=retry`, return_url: `${origin}/dashboard?connect=done` });
      if (typeof data.url !== "string") throw new Error("Stripe sent no link.");
      return data.url;
    },
    async status(accountId) {
      const data = await call("GET", `accounts/${accountId}`);
      return { detailsSubmitted: data.details_submitted === true, payoutsEnabled: data.payouts_enabled === true };
    },
  };
}

/** Starts or resumes onboarding: makes the Stripe account on first use, remembers it, and returns the link. */
export async function startOnboarding(db: Db, provider: ConnectProvider, store: Store, origin: string): Promise<string> {
  let accountId = store.stripeConnectAccount;
  if (!accountId) {
    accountId = await provider.createAccount(store);
    await db.update(stores).set({ stripeConnectAccount: accountId }).where(eq(stores.id, store.id));
  }
  return provider.onboardingUrl(accountId, origin);
}

/** Records Stripe's answer. Un-verifying also takes the store offline, so a seller who loses payouts is not selling. */
export async function setVerified(db: Db, accountId: string, status: AccountStatus): Promise<boolean> {
  const verified = isVerified(status);
  const rows = await db
    .update(stores)
    .set({ connectVerified: verified, ...(verified ? {} : { published: false }) })
    .where(eq(stores.stripeConnectAccount, accountId))
    .returning({ id: stores.id });
  return rows.length > 0;
}

export type PublishResult = { ok: true; store: Store } | { ok: false; error: string; status: number };

/** Puts the seller's store online. Needs a verified Stripe account; checked with Stripe again just now. */
export async function publishStore(db: Db, provider: ConnectProvider | null, store: Store | null): Promise<PublishResult> {
  if (!store) return { ok: false, error: "Open a store first.", status: 409 };
  if (!provider) return { ok: false, error: "Selling is not open yet.", status: 503 };
  if (!store.stripeConnectAccount) return { ok: false, error: "Connect your payout account first.", status: 409 };
  await setVerified(db, store.stripeConnectAccount, await provider.status(store.stripeConnectAccount));
  const [fresh] = await db.select().from(stores).where(eq(stores.id, store.id));
  if (!fresh.connectVerified) return { ok: false, error: "Stripe has not finished verifying your account yet.", status: 409 };
  const [published] = await db.update(stores).set({ published: true }).where(eq(stores.id, store.id)).returning();
  return { ok: true, store: published };
}

/** Webhook: `account.updated` keeps the verified flag current. Returns whether a store was updated. */
export async function handleConnectEvent(db: Db, event: { type?: string; data?: { object?: { id?: string; details_submitted?: boolean; payouts_enabled?: boolean } } }): Promise<"updated" | "ignored"> {
  const account = event.data?.object;
  if (event.type !== "account.updated" || !account?.id) return "ignored";
  const changed = await setVerified(db, account.id, { detailsSubmitted: account.details_submitted === true, payoutsEnabled: account.payouts_enabled === true });
  return changed ? "updated" : "ignored";
}
