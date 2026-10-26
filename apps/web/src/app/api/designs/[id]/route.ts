import {
  getOwnedDesign,
  getOwnedVersion,
  listVersions,
  loadHistory,
  listPendingDimensions,
  loadPhotos,
  loadReferences,
} from "../../../../lib/agent/store";
import { itemsFromHistory } from "../../../../lib/agent/transcript";
import { DatabaseNotConfigured, getDb } from "../../../../lib/db/client";
import { requireOwner } from "../../../../lib/require-owner";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** One design with its versions and its saved conversation, so the page can reopen it. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const who = await requireOwner();
  if ("response" in who) return who.response;
  const { id } = await params;
  if (!UUID.test(id))
    return Response.json({ error: "Not a design." }, { status: 400 });
  try {
    const db = await getDb();
    const design = await getOwnedDesign(db, id, who.ownerId);
    if (!design)
      return Response.json({ error: "Design not found." }, { status: 404 });
    const [versions, history, current, references, photos, pending] = await Promise.all([
      listVersions(db, id),
      loadHistory(db, id),
      getOwnedVersion(db, id, who.ownerId, "current"),
      loadReferences(db, id),
      loadPhotos(db, id),
      listPendingDimensions(db, id),
    ]);
    return Response.json(
      {
        design,
        versions,
        items: itemsFromHistory(history),
        currentSpec: current?.spec ?? null,
        dimensions: references.dimensions,
        photoCount: photos.length,
        pendingDimensions: pending,
      },
      { headers: { "cache-control": "private, no-store" } },
    );
  } catch (error) {
    if (!(error instanceof DatabaseNotConfigured))
      console.error("database unavailable", error);
    return Response.json(
      { error: "The database is not available." },
      { status: 503 },
    );
  }
}
