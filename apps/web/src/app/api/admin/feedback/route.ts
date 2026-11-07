import { DatabaseNotConfigured, getDb } from "../../../../lib/db/client";
import { feedbackQueue } from "../../../../lib/feedback/feedback";
import { reportError } from "../../../../lib/observability";
import { requireAdmin } from "../../../../lib/require-admin";

/** Admin only. Tester feedback with `?status=` new (default), approved or rejected. */
export async function GET(request: Request) {
  const who = await requireAdmin();
  if ("response" in who) return who.response;
  const status = new URL(request.url).searchParams.get("status") ?? "new";
  if (!["new", "approved", "rejected"].includes(status)) return Response.json({ error: "Status must be new, approved or rejected." }, { status: 400 });
  try {
    return Response.json({ feedback: await feedbackQueue(await getDb(), status) }, { headers: { "cache-control": "private, no-store" } });
  } catch (error) {
    if (!(error instanceof DatabaseNotConfigured)) await reportError("database unavailable", error);
    return Response.json({ error: "The database is not available." }, { status: 503 });
  }
}
