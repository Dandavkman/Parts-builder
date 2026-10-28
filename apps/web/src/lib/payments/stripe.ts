import { createHmac, timingSafeEqual } from "node:crypto";
import type { Db } from "../db/client";
import { notifyOrder } from "../email/notify";
import { markPaid } from "../orders/store";
import type { PaymentProvider } from "./provider";

type Env = Record<string, string | undefined>;
type Fetch = typeof fetch;

/** Stripe wants form-encoded bodies with bracketed keys: `line_items[0][quantity]=1`. */
export function formEncode(value: Record<string, unknown>, prefix = ""): string[] {
  return Object.entries(value).flatMap(([key, v]) => {
    const name = prefix ? `${prefix}[${key}]` : key;
    if (v === undefined || v === null) return [];
    if (Array.isArray(v)) return v.flatMap((item, i) => (typeof item === "object" && item !== null ? formEncode(item as Record<string, unknown>, `${name}[${i}]`) : [`${encodeURIComponent(`${name}[${i}]`)}=${encodeURIComponent(String(item))}`]));
    if (typeof v === "object") return formEncode(v as Record<string, unknown>, name);
    return [`${encodeURIComponent(name)}=${encodeURIComponent(String(v))}`];
  });
}

/**
 * Stripe Checkout through the REST API (no SDK). Test keys (`sk_test_`) take test cards only. A live key
 * is refused for an order priced from placeholder rates, so no real card is charged until the Owner has
 * set real pricing (see rate-cards.ts). Stripe Tax is used only when STRIPE_TAX=1 (needs O2.4 first).
 */
export function stripeProvider(env: Env = process.env, doFetch: Fetch = fetch): PaymentProvider | null {
  const key = env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return {
    name: "stripe",
    async start(order, origin) {
      if (key.startsWith("sk_live_") && order.quoteSnapshot.placeholder) {
        throw new Error("Live payments are refused while prices are placeholders.");
      }
      const q = order.quoteSnapshot;
      const body = formEncode({
        mode: "payment",
        client_reference_id: order.id,
        metadata: { order_id: order.id },
        payment_intent_data: { metadata: { order_id: order.id } },
        success_url: `${origin}/dashboard?paid=1`,
        cancel_url: `${origin}/dashboard`,
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: "usd",
              unit_amount: order.totalCents,
              product_data: { name: `${q.quantity} x custom part in ${q.materialName}` },
            },
          },
        ],
        ...(env.STRIPE_TAX === "1" ? { automatic_tax: { enabled: true } } : {}),
      }).join("&");
      const response = await doFetch("https://api.stripe.com/v1/checkout/sessions", {
        method: "POST",
        headers: { authorization: `Bearer ${key}`, "content-type": "application/x-www-form-urlencoded", "idempotency-key": `order_${order.id}` },
        body,
      });
      const data = (await response.json().catch(() => null)) as { url?: string; id?: string } | null;
      if (!response.ok || !data?.url) throw new Error(`Stripe returned ${response.status}.`);
      return { paidNow: false, url: data.url };
    },
  };
}

/** Checks the `Stripe-Signature` header (`t=...,v1=...`) against the raw body. Rejects stale timestamps. */
export function verifyStripeSignature(rawBody: string, header: string | null, secret: string, nowSeconds = Math.floor(Date.now() / 1000), toleranceSeconds = 300): boolean {
  if (!header) return false;
  const parts = Object.fromEntries(header.split(",").map((p) => p.split("=", 2) as [string, string]));
  const t = Number(parts.t);
  if (!Number.isFinite(t) || Math.abs(nowSeconds - t) > toleranceSeconds) return false;
  const expected = createHmac("sha256", secret).update(`${t}.${rawBody}`).digest();
  return header
    .split(",")
    .filter((p) => p.startsWith("v1="))
    .some((p) => {
      const given = Buffer.from(p.slice(3), "hex");
      return given.length === expected.length && timingSafeEqual(given, expected);
    });
}

interface StripeEvent {
  type?: string;
  data?: { object?: { id?: string; client_reference_id?: string; payment_status?: string; payment_intent?: string } };
}

/** Marks the order paid when a Checkout session completes with payment. Other events are ignored. Safe to receive twice. */
export async function handleStripeEvent(db: Db, event: StripeEvent): Promise<"paid" | "ignored"> {
  const session = event.data?.object;
  const paid =
    (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") &&
    session?.payment_status === "paid" &&
    typeof session.client_reference_id === "string";
  if (!paid || !session) return "ignored";
  const order = await markPaid(db, session.client_reference_id as string, { provider: "stripe", ref: session.payment_intent ?? session.id ?? "unknown" });
  if (!order) return "ignored";
  await notifyOrder(db, order, "order_confirmed");
  return "paid";
}
