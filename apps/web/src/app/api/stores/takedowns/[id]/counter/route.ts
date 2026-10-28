import { DatabaseNotConfigured, getDb } from "../../../../../../lib/db/client";
import { reportError } from "../../../../../../lib/observability";
import { requireOwner } from "../../../../../../lib/require-owner";
import { fileCounter } from "../../../../../../lib/takedowns/takedowns";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The seller disputes a removal. Body: `{ text }`. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const who = await requireOwner();
  if ("response" in who) return who.response;
  const { id } = await params;
  const body = (await request.json().catch(() => null)) as { text?: unknown } | null;
  if (!UUID.test(id) || !body) return Response.json({ error: "A claim id and a body are required." }, { status: 400 });
  try {
    const result = await fileCounter(await getDb(), { ownerId: who.ownerId, claimId: id, text: body.text });
    return result.ok ? Response.json({ claim: { id: result.claim.id, status: result.claim.status } }) : Response.json({ error: result.error }, { status: result.status });
  } catch (error) {
    if (!(error instanceof DatabaseNotConfigured)) await reportError("counter-notice failed", error);
    return Response.json({ error: "The database is not available." }, { status: 503 });
  }
}
