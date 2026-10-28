import { DatabaseNotConfigured, getDb } from "../../../lib/db/client";
import { PLAN_LIMITS, plansEnforced } from "../../../lib/plans";
import { aiMessagesUsed, designCount, getPlan } from "../../../lib/plans-store";
import { requireOwner } from "../../../lib/require-owner";
import { reportError } from "../../../lib/observability";

/** The signed-in user's plan, this month's usage and the plan's limits. */
export async function GET() {
  const who = await requireOwner();
  if ("response" in who) return who.response;
  try {
    const db = await getDb();
    const plan = await getPlan(db, who.ownerId);
    const [aiMessages, designs] = await Promise.all([aiMessagesUsed(db, who.ownerId), designCount(db, who.ownerId)]);
    return Response.json(
      { plan, limits: PLAN_LIMITS[plan], usage: { aiMessages, designs }, enforced: plansEnforced() },
      { headers: { "cache-control": "private, no-store" } },
    );
  } catch (error) {
    if (!(error instanceof DatabaseNotConfigured)) await reportError("database unavailable", error);
    return Response.json({ error: "The database is not available." }, { status: 503 });
  }
}
