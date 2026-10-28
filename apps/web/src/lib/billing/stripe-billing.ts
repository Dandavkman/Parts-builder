import type { Db } from "../db/client";
import { formEncode } from "../payments/stripe";
import { ownerForSubscription, saveStripeIds, setPlan } from "../plans-store";

type Env = Record<string, string | undefined>;
type Fetch = typeof fetch;

export interface BillingProvider {
  /** A Stripe Checkout URL that starts the Pro subscription. */
  startPro(ownerId: string, origin: string, customerId: string | null): Promise<string>;
  /** A Stripe customer-portal URL to change or cancel the subscription. */
  openPortal(customerId: string, origin: string): Promise<string>;
}

/**
 * Pro subscriptions through Stripe Billing (REST, no SDK). Needs STRIPE_SECRET_KEY and STRIPE_PRO_PRICE_ID
 * (the recurring Price made in the Stripe dashboard); null when either is missing, which switches the
 * feature off. The Pro price and limits are still placeholders (O2.3), so a live key is refused unless
 * the Owner sets PRO_PRICE_CONFIRMED=1 to say they are real.
 */
export function billingProvider(env: Env = process.env, doFetch: Fetch = fetch): BillingProvider | null {
  const key = env.STRIPE_SECRET_KEY;
  const price = env.STRIPE_PRO_PRICE_ID;
  if (!key || !price) return null;
  const post = async (path: string, body: Record<string, unknown>, idempotencyKey?: string) => {
    const response = await doFetch(`https://api.stripe.com/v1/${path}`, {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/x-www-form-urlencoded", ...(idempotencyKey ? { "idempotency-key": idempotencyKey } : {}) },
      body: formEncode(body).join("&"),
    });
    const data = (await response.json().catch(() => null)) as { url?: string } | null;
    if (!response.ok || !data?.url) throw new Error(`Stripe returned ${response.status}.`);
    return data.url;
  };
  return {
    startPro(ownerId, origin, customerId) {
      if (key.startsWith("sk_live_") && env.PRO_PRICE_CONFIRMED !== "1") {
        throw new Error("Live subscriptions are refused until PRO_PRICE_CONFIRMED=1.");
      }
      return post("checkout/sessions", {
        mode: "subscription",
        client_reference_id: ownerId,
        ...(customerId ? { customer: customerId } : {}),
        metadata: { owner_id: ownerId },
        subscription_data: { metadata: { owner_id: ownerId } },
        line_items: [{ price, quantity: 1 }],
        success_url: `${origin}/dashboard?upgraded=1`,
        cancel_url: `${origin}/dashboard`,
      });
    },
    openPortal(customerId, origin) {
      return post("billing_portal/sessions", { customer: customerId, return_url: `${origin}/dashboard` });
    },
  };
}

interface BillingObject {
  id?: string;
  mode?: string;
  status?: string;
  customer?: string;
  subscription?: string;
  client_reference_id?: string;
  payment_status?: string;
  metadata?: { owner_id?: string };
}
interface BillingEvent {
  type?: string;
  data?: { object?: BillingObject };
}

const ACTIVE = new Set(["active", "trialing"]);

/**
 * Keeps the plan in step with Stripe. A completed subscription checkout makes the user Pro and saves the
 * Stripe ids; later subscription updates and cancellations move them between Pro and Free. Other events
 * are ignored. Setting the same plan twice changes nothing, so a repeated event is safe.
 */
export async function handleBillingEvent(db: Db, event: BillingEvent): Promise<"upgraded" | "downgraded" | "ignored"> {
  const object = event.data?.object;
  if (!object) return "ignored";
  if (event.type === "checkout.session.completed" && object.mode === "subscription") {
    const ownerId = object.client_reference_id ?? object.metadata?.owner_id;
    if (!ownerId) return "ignored";
    await saveStripeIds(db, ownerId, { customerId: object.customer ?? null, subscriptionId: object.subscription ?? null });
    await setPlan(db, ownerId, "pro");
    return "upgraded";
  }
  if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
    const ownerId = (object.id && (await ownerForSubscription(db, object.id))) || object.metadata?.owner_id;
    if (!ownerId) return "ignored";
    const active = event.type !== "customer.subscription.deleted" && ACTIVE.has(object.status ?? "");
    await setPlan(db, ownerId, active ? "pro" : "free");
    return active ? "upgraded" : "downgraded";
  }
  return "ignored";
}
