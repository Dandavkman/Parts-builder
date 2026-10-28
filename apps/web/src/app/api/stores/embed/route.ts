import { DatabaseNotConfigured, getDb } from "../../../../lib/db/client";
import { reportError } from "../../../../lib/observability";
import { requireOwner } from "../../../../lib/require-owner";
import { siteUrl } from "../../../../lib/site";
import { embedSnippet } from "../../../../lib/stores/embed";
import { getOwnedStore, listStoreListings } from "../../../../lib/stores/store";

/** Paste-ready buy-button snippets for the signed-in seller's approved listings. */
export async function GET() {
  const who = await requireOwner();
  if ("response" in who) return who.response;
  try {
    const db = await getDb();
    const store = await getOwnedStore(db, who.ownerId);
    if (!store) return Response.json({ error: "You have no store." }, { status: 404 });
    const origin = siteUrl();
    const items = (await listStoreListings(db, store.id))
      .filter((l) => l.reviewStatus === "approved")
      .map((l) => ({ listingId: l.id, title: l.title, snippet: embedSnippet(origin, store.slug, l.id) }));
    return Response.json({ published: store.published, buttons: items }, { headers: { "cache-control": "private, no-store" } });
  } catch (error) {
    if (!(error instanceof DatabaseNotConfigured)) await reportError("database unavailable", error);
    return Response.json({ error: "The database is not available." }, { status: 503 });
  }
}
