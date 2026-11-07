import { getOwnedDesign } from "../../../../../lib/agent/store";
import { DatabaseNotConfigured, getDb } from "../../../../../lib/db/client";
import { feedbackForOwner, submitFeedback } from "../../../../../lib/feedback/feedback";
import { reportError } from "../../../../../lib/observability";
import { hit, LIMITS, tooMany } from "../../../../../lib/rate-limit";
import { requireOwner } from "../../../../../lib/require-owner";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The signed-in user's own feedback on this design, newest first, with its status. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const who = await requireOwner();
  if ("response" in who) return who.response;
  const { id } = await params;
  if (!UUID.test(id)) return Response.json({ error: "Not a design." }, { status: 400 });
  try {
    const db = await getDb();
    if (!(await getOwnedDesign(db, id, who.ownerId))) return Response.json({ error: "Design not found." }, { status: 404 });
    return Response.json({ feedback: await feedbackForOwner(db, who.ownerId, id) }, { headers: { "cache-control": "private, no-store" } });
  } catch (error) {
    if (!(error instanceof DatabaseNotConfigured)) await reportError("database unavailable", error);
    return Response.json({ error: "The database is not available." }, { status: 503 });
  }
}

/** Body: `{ body }`. Saves a comment about this design for the admin to review. Rate limited per user. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const who = await requireOwner();
  if ("response" in who) return who.response;
  const { id } = await params;
  if (!UUID.test(id)) return Response.json({ error: "Not a design." }, { status: 400 });
  const input = (await request.json().catch(() => null)) as { body?: unknown } | null;
  if (!input) return Response.json({ error: "Feedback is required." }, { status: 400 });
  try {
    const db = await getDb();
    const limited = await hit(db, LIMITS.feedback, who.ownerId);
    if (!limited.ok) return tooMany(limited);
    const result = await submitFeedback(db, { ownerId: who.ownerId, designId: id, body: input.body });
    if (!result.ok) return Response.json({ error: result.error }, { status: result.status });
    return Response.json({ id: result.feedback.id, status: result.feedback.status }, { status: 201 });
  } catch (error) {
    if (!(error instanceof DatabaseNotConfigured)) await reportError("feedback failed", error);
    return Response.json({ error: "We could not save that right now. Please try again later." }, { status: 503 });
  }
}
