import { DatabaseNotConfigured, getDb } from "../../../../lib/db/client";
import { reportError } from "../../../../lib/observability";
import { publicStore } from "../../../../lib/stores/review";

/** Public. A published store and its approved listings, with no owner or review details. */
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  try {
    const shop = await publicStore(await getDb(), slug.toLowerCase().slice(0, 40));
    if (!shop) return Response.json({ error: "Store not found." }, { status: 404 });
    return Response.json(shop, { headers: { "cache-control": "public, max-age=60" } });
  } catch (error) {
    if (!(error instanceof DatabaseNotConfigured)) await reportError("database unavailable", error);
    return Response.json({ error: "The database is not available." }, { status: 503 });
  }
}
