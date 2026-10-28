import { DatabaseNotConfigured, getDb } from "../../../../lib/db/client";
import { reportError } from "../../../../lib/observability";
import { requireOwner } from "../../../../lib/require-owner";
import { balanceCents, ledgerFor } from "../../../../lib/stores/ledger";
import { getOwnedStore } from "../../../../lib/stores/store";

/** The signed-in seller's balance and ledger. Only their own store is ever returned. */
export async function GET() {
  const who = await requireOwner();
  if ("response" in who) return who.response;
  try {
    const db = await getDb();
    const store = await getOwnedStore(db, who.ownerId);
    if (!store) return Response.json({ error: "You have no store." }, { status: 404 });
    const [balance, entries] = await Promise.all([balanceCents(db, store.id), ledgerFor(db, store.id)]);
    return Response.json({ balanceCents: balance, entries }, { headers: { "cache-control": "private, no-store" } });
  } catch (error) {
    if (!(error instanceof DatabaseNotConfigured)) await reportError("database unavailable", error);
    return Response.json({ error: "The database is not available." }, { status: 503 });
  }
}
