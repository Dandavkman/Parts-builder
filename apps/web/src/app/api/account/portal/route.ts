import { billingProvider } from "../../../../lib/billing/stripe-billing";
import { DatabaseNotConfigured, getDb } from "../../../../lib/db/client";
import { reportError } from "../../../../lib/observability";
import { getStripeCustomerId } from "../../../../lib/plans-store";
import { requireOwner } from "../../../../lib/require-owner";

/** Returns `{ url }` of the Stripe page where a Pro user changes or cancels their subscription. */
export async function POST(request: Request) {
  const who = await requireOwner();
  if ("response" in who) return who.response;
  const billing = billingProvider();
  if (!billing) return Response.json({ error: "Subscriptions are not open yet." }, { status: 503 });
  try {
    const customerId = await getStripeCustomerId(await getDb(), who.ownerId);
    if (!customerId) return Response.json({ error: "You have no subscription to manage." }, { status: 404 });
    return Response.json({ url: await billing.openPortal(customerId, new URL(request.url).origin) });
  } catch (error) {
    if (!(error instanceof DatabaseNotConfigured)) await reportError("portal failed", error);
    return Response.json({ error: "We could not open the billing page. Please try again later." }, { status: 503 });
  }
}
