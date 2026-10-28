import { DatabaseNotConfigured, getDb } from "../../../../../lib/db/client";
import { createListing, getOwnedStore } from "../../../../../lib/stores/store";
import { requireOwner } from "../../../../../lib/require-owner";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Lists a design version in the user's own store. Body: `{ designId, quoteId, retailCents, title }`. The listing waits for review. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const who = await requireOwner();
  if ("response" in who) return who.response;
  const { id } = await params;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!UUID.test(id) || !body || typeof body.designId !== "string" || !UUID.test(body.designId) || typeof body.quoteId !== "string" || !UUID.test(body.quoteId)) {
    return Response.json({ error: "designId and quoteId are required." }, { status: 400 });
  }
  try {
    const db = await getDb();
    const store = await getOwnedStore(db, who.ownerId);
    if (!store || store.id !== id) return Response.json({ error: "Store not found." }, { status: 404 });
    const result = await createListing(db, { ownerId: who.ownerId, designId: body.designId, quoteId: body.quoteId, retailCents: body.retailCents, title: body.title });
    return result.ok ? Response.json({ listing: result.listing }, { status: 201 }) : Response.json({ error: result.error }, { status: result.status });
  } catch (error) {
    if (!(error instanceof DatabaseNotConfigured)) console.error("listing failed", error);
    return Response.json({ error: "The database is not available." }, { status: 503 });
  }
}
