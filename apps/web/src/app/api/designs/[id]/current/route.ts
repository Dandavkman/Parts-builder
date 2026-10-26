import { setCurrentVersion } from "../../../../../lib/agent/store";
import { DatabaseNotConfigured, getDb } from "../../../../../lib/db/client";
import { requireOwner } from "../../../../../lib/require-owner";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Body `{ version }`: makes that earlier version that built the current one (undo). */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const who = await requireOwner();
  if ("response" in who) return who.response;
  const { id } = await params;
  const body = (await request.json().catch(() => null)) as {
    version?: unknown;
  } | null;
  const version = body?.version;
  if (
    !UUID.test(id) ||
    typeof version !== "number" ||
    !Number.isInteger(version) ||
    version < 1
  ) {
    return Response.json(
      {
        error: "Send { version: <number> } for one of this design's versions.",
      },
      { status: 400 },
    );
  }
  try {
    const result = await setCurrentVersion(
      await getDb(),
      id,
      who.ownerId,
      version,
    );
    if (result === "not_found")
      return Response.json({ error: "Version not found." }, { status: 404 });
    if (result === "not_built")
      return Response.json(
        { error: "That version did not build, so it cannot be current." },
        { status: 409 },
      );
    return Response.json({ current_version: version });
  } catch (error) {
    if (!(error instanceof DatabaseNotConfigured))
      console.error("database unavailable", error);
    return Response.json(
      { error: "The database is not available." },
      { status: 503 },
    );
  }
}
