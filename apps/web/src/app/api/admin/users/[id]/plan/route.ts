import { DatabaseNotConfigured, getDb } from "../../../../../../lib/db/client";
import { isPlan } from "../../../../../../lib/plans";
import { setPlan } from "../../../../../../lib/plans-store";
import { requireAdmin } from "../../../../../../lib/require-admin";
import { reportError } from "../../../../../../lib/observability";

/** Sets a user's plan (until Stripe Billing is connected). Body: `{ plan: "free" | "pro" }`. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const who = await requireAdmin();
  if ("response" in who) return who.response;
  const { id } = await params;
  const body = (await request.json().catch(() => null)) as { plan?: unknown } | null;
  if (!id || id.length > 200 || !isPlan(body?.plan)) return Response.json({ error: "A user id and a plan (free or pro) are required." }, { status: 400 });
  try {
    await setPlan(await getDb(), id, body.plan);
    return Response.json({ ok: true, plan: body.plan });
  } catch (error) {
    if (!(error instanceof DatabaseNotConfigured)) await reportError("database unavailable", error);
    return Response.json({ error: "The database is not available." }, { status: 503 });
  }
}
