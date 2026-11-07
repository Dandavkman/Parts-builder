import { DatabaseNotConfigured, getDb } from "../../../../../lib/db/client";
import { decideFeedback } from "../../../../../lib/feedback/feedback";
import { reportError } from "../../../../../lib/observability";
import { requireAdmin } from "../../../../../lib/require-admin";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Body: `{ decision: "approve" | "reject", note? }`. Approving opens a GitHub issue for the coding agent when it is set up. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const who = await requireAdmin();
  if ("response" in who) return who.response;
  const { id } = await params;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!UUID.test(id) || !body) return Response.json({ error: "A feedback id and a body are required." }, { status: 400 });
  try {
    const result = await decideFeedback(await getDb(), { id, adminId: who.adminId, decision: body.decision, note: body.note });
    return result.ok ? Response.json({ feedback: result.feedback }) : Response.json({ error: result.error }, { status: result.status });
  } catch (error) {
    if (!(error instanceof DatabaseNotConfigured)) await reportError("feedback decision failed", error);
    return Response.json({ error: "The database is not available." }, { status: 503 });
  }
}
