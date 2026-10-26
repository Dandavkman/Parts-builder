import { buildWithGeometryService } from "../../../../../lib/agent/geometry-client";
import { getOwnedDesign, getOwnedVersion, recorderFor } from "../../../../../lib/agent/store";
import { onlyNumbersChanged } from "../../../../../lib/agent/spec-numbers";
import { DatabaseNotConfigured, getDb } from "../../../../../lib/db/client";
import { requireOwner } from "../../../../../lib/require-owner";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_BODY_BYTES = 200_000;

/**
 * Slider edits. Body `{ base_version, spec }`: `spec` must be the base version's spec with only
 * numbers changed. It is rebuilt without calling the AI and saved as a new version (`created_by`
 * "slider") only if it builds, so a drag through invalid values leaves no failed versions behind.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const who = await requireOwner();
  if ("response" in who) return who.response;
  const { id } = await params;
  const text = await request.text();
  const body = (text.length <= MAX_BODY_BYTES ? safeParse(text) : null) as { base_version?: unknown; spec?: unknown } | null;
  const base = body?.base_version;
  if (!UUID.test(id) || typeof base !== "number" || !Number.isInteger(base) || !body?.spec || typeof body.spec !== "object") {
    return Response.json({ error: "Send { base_version, spec }." }, { status: 400 });
  }

  let db;
  try {
    db = await getDb();
  } catch (error) {
    if (!(error instanceof DatabaseNotConfigured)) console.error("database unavailable", error);
    return Response.json({ error: "The database is not available." }, { status: 503 });
  }
  const baseRow = await getOwnedVersion(db, id, who.ownerId, base);
  if (!baseRow) return Response.json({ error: "Version not found." }, { status: 404 });
  const spec = body.spec as Record<string, unknown>;
  if (!onlyNumbersChanged(baseRow.spec, spec)) {
    return Response.json({ error: "Sliders can only change numbers in the spec." }, { status: 400 });
  }

  let outcome;
  try {
    outcome = await buildWithGeometryService(spec, baseRow.anchors);
  } catch {
    return Response.json({ error: "The geometry service is not reachable." }, { status: 502 });
  }
  if (!outcome.ok) return Response.json({ ok: false, errors: outcome.errors });

  await recorderFor(db, id).version({ spec, anchors: baseRow.anchors, ok: true, errors: [], createdBy: "slider" });
  const design = await getOwnedDesign(db, id, who.ownerId);
  return Response.json({ ok: true, version: design?.currentVersion ?? null });
}

function safeParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
