import { billingProvider } from "../../../../lib/billing/stripe-billing";
import { DatabaseNotConfigured, getDb } from "../../../../lib/db/client";
import { reportError } from "../../../../lib/observability";
import { getPlan, getStripeCustomerId } from "../../../../lib/plans-store";
import { requireOwner } from "../../../../lib/require-owner";

/** Starts the Pro subscription: returns `{ url }` of a Stripe Checkout page. 503 until Stripe Billing is set up. */
export async function POST(request: Request) {
  const who = await requireOwner();
  if ("response" in who) return who.response;
  const billing = billingProvider();
  if (!billing) return Response.json({ error: "Subscriptions are not open yet." }, { status: 503 });
  try {
    const db = await getDb();
    if ((await getPlan(db, who.ownerId)) === "pro") return Response.json({ error: "You are already on Pro." }, { status: 409 });
    const url = await billing.startPro(who.ownerId, new URL(request.url).origin, await getStripeCustomerId(db, who.ownerId));
    return Response.json({ url });
  } catch (error) {
    if (!(error instanceof DatabaseNotConfigured)) await reportError("upgrade failed", error);
    return Response.json({ error: "We could not start the upgrade. Please try again later." }, { status: 503 });
  }
}
