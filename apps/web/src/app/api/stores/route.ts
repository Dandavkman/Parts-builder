import { DatabaseNotConfigured, getDb } from "../../../lib/db/client";
import { PLATFORM_FEE_PERCENT, STORE_FEES_ARE_PLACEHOLDER } from "../../../lib/stores/royalty";
import { createStore, getOwnedStore, listStoreListings } from "../../../lib/stores/store";
import { requireOwner } from "../../../lib/require-owner";

const unavailable = (error: unknown) => {
  if (!(error instanceof DatabaseNotConfigured)) console.error("database unavailable", error);
  return Response.json({ error: "The database is not available." }, { status: 503 });
};

/** The signed-in user's store and its listings, or `{ store: null }`. */
export async function GET() {
  const who = await requireOwner();
  if ("response" in who) return who.response;
  try {
    const db = await getDb();
    const store = await getOwnedStore(db, who.ownerId);
    const listings = store ? await listStoreListings(db, store.id) : [];
    return Response.json({ store, listings, platformFeePercent: PLATFORM_FEE_PERCENT, placeholder: STORE_FEES_ARE_PLACEHOLDER }, { headers: { "cache-control": "private, no-store" } });
  } catch (error) {
    return unavailable(error);
  }
}

/** Opens a store. Body: `{ name, slug }`. It stays unpublished until the seller is verified (B4.1). */
export async function POST(request: Request) {
  const who = await requireOwner();
  if ("response" in who) return who.response;
  const body = (await request.json().catch(() => null)) as { name?: unknown; slug?: unknown } | null;
  try {
    const result = await createStore(await getDb(), who.ownerId, body?.name, body?.slug);
    return result.ok ? Response.json({ store: result.store }, { status: 201 }) : Response.json({ error: result.error }, { status: 400 });
  } catch (error) {
    return unavailable(error);
  }
}
