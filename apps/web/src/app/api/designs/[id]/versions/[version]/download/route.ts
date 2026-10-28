import { buildFile, type GeometryFormat } from "../../../../../../../lib/agent/geometry-client";
import { getOwnedVersion } from "../../../../../../../lib/agent/store";
import { DatabaseNotConfigured, getDb } from "../../../../../../../lib/db/client";
import { checkStepExport, plansEnforced } from "../../../../../../../lib/plans";
import { getPlan } from "../../../../../../../lib/plans-store";
import { requireOwner } from "../../../../../../../lib/require-owner";

const FORMATS: GeometryFormat[] = ["step", "stl", "glb"];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Builds a saved version of the user's design as STEP, STL or GLB (`?format=`, default step).
 * `version` is a number or `current` (the latest version that built).
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string; version: string }> }) {
  const who = await requireOwner();
  if ("response" in who) return who.response;

  const { id, version } = await params;
  const format = (new URL(request.url).searchParams.get("format") ?? "step") as GeometryFormat;
  const which = version === "current" ? "current" : Number(version);
  if (!FORMATS.includes(format)) return Response.json({ error: "format must be step, stl or glb." }, { status: 400 });
  if (!UUID.test(id) || (which !== "current" && !Number.isInteger(which))) {
    return Response.json({ error: "Not a design version." }, { status: 400 });
  }

  let row;
  try {
    const db = await getDb();
    if (format === "step" && plansEnforced()) {
      const allowed = checkStepExport(await getPlan(db, who.ownerId));
      if (!allowed.ok) return Response.json({ error: allowed.error, upgrade: true }, { status: 402 });
    }
    row = await getOwnedVersion(db, id, who.ownerId, which);
  } catch (error) {
    if (!(error instanceof DatabaseNotConfigured)) console.error("database unavailable", error);
    return Response.json({ error: "The database is not available." }, { status: 503 });
  }
  if (!row) return Response.json({ error: "Version not found." }, { status: 404 });
  if (!row.buildOk) {
    return Response.json({ error: "That version did not build.", errors: row.buildErrors }, { status: 409 });
  }

  let built;
  try {
    built = await buildFile(row.spec, row.anchors, format);
  } catch {
    return Response.json({ error: "The geometry service is not reachable." }, { status: 502 });
  }
  if (!built.ok) return Response.json({ error: "That version no longer builds.", errors: built.errors }, { status: 422 });
  const headers: Record<string, string> = { "content-type": built.contentType, "cache-control": "private, no-store" };
  if (built.contentDisposition) headers["content-disposition"] = built.contentDisposition;
  return new Response(built.body, { headers });
}
