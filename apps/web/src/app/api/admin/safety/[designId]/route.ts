import { DatabaseNotConfigured, getDb } from "../../../../../lib/db/client";
import { decideReview } from "../../../../../lib/safety/store";
import { requireAdmin } from "../../../../../lib/require-admin";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Approve or reject a design that needs review. Body: `{ decision: "approved" | "rejected" }`. */
export async function POST(request: Request, { params }: { params: Promise<{ designId: string }> }) {
  const who = await requireAdmin();
  if ("response" in who) return who.response;
  const { designId } = await params;
  const body = (await request.json().catch(() => null)) as { decision?: unknown } | null;
  if (!UUID.test(designId) || (body?.decision !== "approved" && body?.decision !== "rejected")) {
    return Response.json({ error: "A design id and a decision (approved or rejected) are required." }, { status: 400 });
  }
  try {
    const result = await decideReview(await getDb(), designId, body.decision, who.adminId);
    if (result.ok) return Response.json({ status: result.status });
    return result.reason === "not_found"
      ? Response.json({ error: "Design not found." }, { status: 404 })
      : Response.json({ error: "That design is not waiting for review." }, { status: 409 });
  } catch (error) {
    if (!(error instanceof DatabaseNotConfigured)) console.error("database unavailable", error);
    return Response.json({ error: "The database is not available." }, { status: 503 });
  }
}
