import { connectProvider, startOnboarding } from "../../../../lib/connect/stripe-connect";
import { DatabaseNotConfigured, getDb } from "../../../../lib/db/client";
import { reportError } from "../../../../lib/observability";
import { requireOwner } from "../../../../lib/require-owner";
import { getOwnedStore } from "../../../../lib/stores/store";

/** Returns `{ url }` of Stripe's payout-account setup page for the signed-in seller. 503 until Connect is switched on. */
export async function POST(request: Request) {
  const who = await requireOwner();
  if ("response" in who) return who.response;
  try {
    const provider = connectProvider();
    if (!provider) return Response.json({ error: "Selling is not open yet." }, { status: 503 });
    const db = await getDb();
    const store = await getOwnedStore(db, who.ownerId);
    if (!store) return Response.json({ error: "Open a store first." }, { status: 409 });
    return Response.json({ url: await startOnboarding(db, provider, store, new URL(request.url).origin) });
  } catch (error) {
    if (!(error instanceof DatabaseNotConfigured)) await reportError("connect onboarding failed", error);
    return Response.json({ error: "We could not start setup. Please try again later." }, { status: 503 });
  }
}
