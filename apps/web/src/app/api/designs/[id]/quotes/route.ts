import { buildFile } from "../../../../../lib/agent/geometry-client";
import { stlBounds, stlVolumeMm3 } from "../../../../../lib/agent/stl";
import { getOwnedDesign, getOwnedVersion } from "../../../../../lib/agent/store";
import { DatabaseNotConfigured, getDb } from "../../../../../lib/db/client";
import { buildQuotes, MAX_QUANTITY } from "../../../../../lib/quotes/engine";
import { loadRates } from "../../../../../lib/quotes/rates-store";
import { listQuotes, saveQuotes } from "../../../../../lib/quotes/store";
import { requireOwner } from "../../../../../lib/require-owner";
import { reportError } from "../../../../../lib/observability";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Unexpired quotes for the design's current version, cheapest first. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const who = await requireOwner();
  if ("response" in who) return who.response;
  const { id } = await params;
  if (!UUID.test(id)) return Response.json({ error: "Not a design." }, { status: 400 });
  try {
    const db = await getDb();
    const design = await getOwnedDesign(db, id, who.ownerId);
    if (!design) return Response.json({ error: "Design not found." }, { status: 404 });
    const quotes = design.currentVersion ? await listQuotes(db, id, design.currentVersion) : [];
    return Response.json({ quotes, placeholder: quotes.some((q) => q.placeholder) }, { headers: { "cache-control": "private, no-store" } });
  } catch (error) {
    if (!(error instanceof DatabaseNotConfigured)) await reportError("database unavailable", error);
    return Response.json({ error: "The database is not available." }, { status: 503 });
  }
}

/** Builds the current version, measures it, and saves one quote per capable partner and material. Body: `{ quantity }`. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const who = await requireOwner();
  if ("response" in who) return who.response;
  const { id } = await params;
  if (!UUID.test(id)) return Response.json({ error: "Not a design." }, { status: 400 });
  const body = (await request.json().catch(() => null)) as { quantity?: unknown } | null;
  const quantity = body?.quantity === undefined ? 1 : body.quantity;
  if (typeof quantity !== "number" || !Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY) {
    return Response.json({ error: `quantity must be a whole number from 1 to ${MAX_QUANTITY}.` }, { status: 400 });
  }

  let db;
  let row;
  try {
    db = await getDb();
    const design = await getOwnedDesign(db, id, who.ownerId);
    if (design?.safetyStatus === "blocked") return Response.json({ error: "This design is in a category we do not make." }, { status: 403 });
    row = await getOwnedVersion(db, id, who.ownerId, "current");
  } catch (error) {
    if (!(error instanceof DatabaseNotConfigured)) await reportError("database unavailable", error);
    return Response.json({ error: "The database is not available." }, { status: 503 });
  }
  if (!row) return Response.json({ error: "Nothing to quote yet: the design has no version that built." }, { status: 404 });
  if (!row.buildOk) return Response.json({ error: "That version did not build.", errors: row.buildErrors }, { status: 409 });

  let built;
  try {
    built = await buildFile(row.spec, row.anchors, "stl");
  } catch {
    return Response.json({ error: "The geometry service is not reachable." }, { status: 502 });
  }
  if (!built.ok) return Response.json({ error: "That version no longer builds.", errors: built.errors }, { status: 422 });
  const bounds = stlBounds(built.body);
  const volume_mm3 = stlVolumeMm3(built.body);
  if (!bounds || !volume_mm3) return Response.json({ error: "The built part has no volume to quote." }, { status: 422 });

  const size_mm = [0, 1, 2].map((i) => bounds.max[i] - bounds.min[i]) as [number, number, number];
  const { config } = await loadRates(db);
  const result = buildQuotes({ volume_mm3, size_mm, spec: row.spec, quantity, partners: config.partners, markupPercent: config.markupPercent, placeholder: config.placeholder });
  const saved = await saveQuotes(db, id, row.version, result.quotes);
  return Response.json(
    { version: row.version, quotes: saved, unquoted: result.unquoted, volume_cm3: volume_mm3 / 1000, size_mm, placeholder: config.placeholder },
    { headers: { "cache-control": "private, no-store" } },
  );
}
