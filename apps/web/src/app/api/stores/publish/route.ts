import { connectProvider, publishStore } from "../../../../lib/connect/stripe-connect";
import { DatabaseNotConfigured, getDb } from "../../../../lib/db/client";
import { reportError } from "../../../../lib/observability";
import { requireOwner } from "../../../../lib/require-owner";
import { getOwnedStore } from "../../../../lib/stores/store";

/** Puts the seller's store online once Stripe has verified their payout account. */
export async function POST() {
  const who = await requireOwner();
  if ("response" in who) return who.response;
  try {
    const db = await getDb();
    const result = await publishStore(db, connectProvider(), await getOwnedStore(db, who.ownerId));
    if (!result.ok) return Response.json({ error: result.error }, { status: result.status });
    return Response.json({ store: result.store });
  } catch (error) {
    if (!(error instanceof DatabaseNotConfigured)) await reportError("publish failed", error);
    return Response.json({ error: "We could not publish the store. Please try again later." }, { status: 503 });
  }
}
