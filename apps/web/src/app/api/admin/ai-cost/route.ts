import { costReport } from "../../../../lib/ai-cost";
import { DatabaseNotConfigured, getDb } from "../../../../lib/db/client";
import { requireAdmin } from "../../../../lib/require-admin";
import { reportError } from "../../../../lib/observability";

/** AI spend over the last `?days=` days (default 1, up to 90): total, most expensive designs and users. Prices are estimates. */
export async function GET(request: Request) {
  const who = await requireAdmin();
  if ("response" in who) return who.response;
  const days = Number(new URL(request.url).searchParams.get("days") ?? 1);
  if (!Number.isFinite(days) || days <= 0 || days > 90) return Response.json({ error: "days must be between 0 and 90." }, { status: 400 });
  try {
    const report = await costReport(await getDb(), new Date(Date.now() - days * 24 * 3600 * 1000));
    return Response.json(report, { headers: { "cache-control": "private, no-store" } });
  } catch (error) {
    if (!(error instanceof DatabaseNotConfigured)) await reportError("database unavailable", error);
    return Response.json({ error: "The database is not available." }, { status: 503 });
  }
}
