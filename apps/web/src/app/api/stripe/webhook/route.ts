import { DatabaseNotConfigured, getDb } from "../../../../lib/db/client";
import { handleBillingEvent } from "../../../../lib/billing/stripe-billing";
import { handleStripeEvent, verifyStripeSignature } from "../../../../lib/payments/stripe";
import { reportError } from "../../../../lib/observability";

/** Stripe calls this when a payment completes. The signature is checked against STRIPE_WEBHOOK_SECRET before anything is read. */
export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return Response.json({ error: "Webhook is not configured." }, { status: 503 });
  const raw = await request.text();
  if (!verifyStripeSignature(raw, request.headers.get("stripe-signature"), secret)) {
    return Response.json({ error: "Bad signature." }, { status: 400 });
  }
  let event;
  try {
    event = JSON.parse(raw);
  } catch {
    return Response.json({ error: "Not JSON." }, { status: 400 });
  }
  try {
    const db = await getDb();
    const order = await handleStripeEvent(db, event);
    const result = order !== "ignored" ? order : await handleBillingEvent(db, event);
    return Response.json({ received: true, result });
  } catch (error) {
    if (!(error instanceof DatabaseNotConfigured)) await reportError("stripe webhook failed", error);
    // A 5xx makes Stripe retry later, which is what we want if the database was briefly down.
    return Response.json({ error: "Could not record the payment." }, { status: 503 });
  }
}
