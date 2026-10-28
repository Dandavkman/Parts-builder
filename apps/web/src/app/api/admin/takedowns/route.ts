import { DatabaseNotConfigured, getDb } from "../../../../lib/db/client";
import { reportError } from "../../../../lib/observability";
import { requireAdmin } from "../../../../lib/require-admin";
import { claimQueue } from "../../../../lib/takedowns/takedowns";

/** New claims and disputed removals waiting for an admin. */
export async function GET() {
  const who = await requireAdmin();
  if ("response" in who) return who.response;
  try {
    return Response.json({ claims: await claimQueue(await getDb()) }, { headers: { "cache-control": "private, no-store" } });
  } catch (error) {
    if (!(error instanceof DatabaseNotConfigured)) await reportError("database unavailable", error);
    return Response.json({ error: "The database is not available." }, { status: 503 });
  }
}
