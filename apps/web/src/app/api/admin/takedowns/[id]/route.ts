import { DatabaseNotConfigured, getDb } from "../../../../../lib/db/client";
import { reportError } from "../../../../../lib/observability";
import { requireAdmin } from "../../../../../lib/require-admin";
import { decideClaim, decideCounter } from "../../../../../lib/takedowns/takedowns";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Decides a claim. Body: `{ decision, note }`. For a new claim, decision is "remove" (take the listing down
 * now) or "dismiss". After the seller disputes a removal, it is "restore" or "uphold".
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const who = await requireAdmin();
  if ("response" in who) return who.response;
  const { id } = await params;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!UUID.test(id) || !body) return Response.json({ error: "A claim id and a body are required." }, { status: 400 });
  try {
    const db = await getDb();
    const input = { claimId: id, adminId: who.adminId, decision: body.decision, note: body.note };
    const result = body.decision === "restore" || body.decision === "uphold" ? await decideCounter(db, input) : await decideClaim(db, input);
    return result.ok ? Response.json({ claim: result.claim }) : Response.json({ error: result.error }, { status: result.status });
  } catch (error) {
    if (!(error instanceof DatabaseNotConfigured)) await reportError("takedown decision failed", error);
    return Response.json({ error: "The database is not available." }, { status: 503 });
  }
}
