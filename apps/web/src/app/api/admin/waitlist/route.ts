import { desc } from "drizzle-orm";
import { DatabaseNotConfigured, getDb } from "../../../../lib/db/client";
import { waitlist } from "../../../../lib/db/schema";
import { reportError } from "../../../../lib/observability";
import { requireAdmin } from "../../../../lib/require-admin";
import { waitlistCsv } from "../../../../lib/waitlist/emails";

/** Admin only. The waitlist, newest first. `?format=csv` downloads it as a spreadsheet; otherwise JSON with a count. */
export async function GET(request: Request) {
  const who = await requireAdmin();
  if ("response" in who) return who.response;
  try {
    const rows = await (await getDb()).select().from(waitlist).orderBy(desc(waitlist.createdAt));
    const headers = { "cache-control": "private, no-store" };
    if (new URL(request.url).searchParams.get("format") === "csv") {
      return new Response(waitlistCsv(rows), { headers: { ...headers, "content-type": "text/csv; charset=utf-8", "content-disposition": 'attachment; filename="waitlist.csv"' } });
    }
    return Response.json({ count: rows.length, entries: rows.map((r) => ({ email: r.email, joinedAt: r.createdAt })) }, { headers });
  } catch (error) {
    if (!(error instanceof DatabaseNotConfigured)) await reportError("database unavailable", error);
    return Response.json({ error: "The database is not available." }, { status: 503 });
  }
}
