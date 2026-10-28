import { eq } from "drizzle-orm";
import { DatabaseNotConfigured, getDb } from "../../../../lib/db/client";
import { stores } from "../../../../lib/db/schema";
import { reportError } from "../../../../lib/observability";
import { requireOwner } from "../../../../lib/require-owner";
import { getOwnedStore } from "../../../../lib/stores/store";

/** `{ showPlatformBrand: boolean }`: whether buyers of this store's items also see our name on emails and packing slips. Off by default. */
export async function POST(request: Request) {
  const who = await requireOwner();
  if ("response" in who) return who.response;
  const body = (await request.json().catch(() => null)) as { showPlatformBrand?: unknown } | null;
  if (typeof body?.showPlatformBrand !== "boolean") return Response.json({ error: "Send { showPlatformBrand: true | false }." }, { status: 400 });
  try {
    const db = await getDb();
    const store = await getOwnedStore(db, who.ownerId);
    if (!store) return Response.json({ error: "You have no store." }, { status: 404 });
    const [updated] = await db.update(stores).set({ showPlatformBrand: body.showPlatformBrand }).where(eq(stores.id, store.id)).returning();
    return Response.json({ store: updated });
  } catch (error) {
    if (!(error instanceof DatabaseNotConfigured)) await reportError("database unavailable", error);
    return Response.json({ error: "The database is not available." }, { status: 503 });
  }
}
