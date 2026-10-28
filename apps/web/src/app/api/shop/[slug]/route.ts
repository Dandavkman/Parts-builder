import { DatabaseNotConfigured, getDb } from "../../../../lib/db/client";
import { reportError } from "../../../../lib/observability";
import { publicStore } from "../../../../lib/stores/review";

/** Any website may read this (the buy button does); it holds only public data. */
const CORS = { "access-control-allow-origin": "*" };

export function OPTIONS() {
  return new Response(null, { status: 204, headers: { ...CORS, "access-control-allow-methods": "GET", "access-control-max-age": "86400" } });
}

/** Public. A published store and its approved listings, with no owner or review details. */
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  try {
    const shop = await publicStore(await getDb(), slug.toLowerCase().slice(0, 40));
    if (!shop) return Response.json({ error: "Store not found." }, { status: 404, headers: CORS });
    return Response.json(shop, { headers: { ...CORS, "cache-control": "public, max-age=60" } });
  } catch (error) {
    if (!(error instanceof DatabaseNotConfigured)) await reportError("database unavailable", error);
    return Response.json({ error: "The database is not available." }, { status: 503 });
  }
}
