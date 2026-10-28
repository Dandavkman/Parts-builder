import { DatabaseNotConfigured, getDb } from "../../../../lib/db/client";
import { grantLicense } from "../../../../lib/licenses/licenses";
import { reportError } from "../../../../lib/observability";
import { requireAdmin } from "../../../../lib/require-admin";

/** Grants a user a scan license by hand. Body: `{ ownerId, vehicleId, area, note? }`. */
export async function POST(request: Request) {
  const who = await requireAdmin();
  if ("response" in who) return who.response;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body.ownerId !== "string" || !body.ownerId.trim()) return Response.json({ error: "ownerId is required." }, { status: 400 });
  try {
    const result = await grantLicense(await getDb(), {
      ownerId: body.ownerId.trim(),
      vehicleId: body.vehicleId,
      area: body.area,
      source: "admin",
      ref: typeof body.note === "string" ? body.note.slice(0, 200) : `granted by ${who.adminId}`,
    });
    if (!result.ok) return Response.json({ error: result.error }, { status: result.status });
    return Response.json({ license: result.license, duplicate: result.duplicate }, { status: result.duplicate ? 200 : 201 });
  } catch (error) {
    if (!(error instanceof DatabaseNotConfigured)) await reportError("license grant failed", error);
    return Response.json({ error: "The database is not available." }, { status: 503 });
  }
}
