import { DatabaseNotConfigured, getDb } from "../../../lib/db/client";
import { LIMITS, limitsEnforced } from "../../../lib/limits";
import { aiMessagesUsed, designCount } from "../../../lib/limits-store";
import { requireOwner } from "../../../lib/require-owner";
import { reportError } from "../../../lib/observability";

/** This month's usage and the limits (the same for everyone). */
export async function GET() {
  const who = await requireOwner();
  if ("response" in who) return who.response;
  try {
    const db = await getDb();
    const [aiMessages, designs] = await Promise.all([aiMessagesUsed(db, who.ownerId), designCount(db, who.ownerId)]);
    return Response.json(
      { limits: LIMITS, usage: { aiMessages, designs }, enforced: limitsEnforced() },
      { headers: { "cache-control": "private, no-store" } },
    );
  } catch (error) {
    if (!(error instanceof DatabaseNotConfigured)) await reportError("database unavailable", error);
    return Response.json({ error: "The database is not available." }, { status: 503 });
  }
}
