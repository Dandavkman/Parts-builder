import { benchmarkCandidates, successRate, topFailures } from "../../../../lib/agent/failure-report";
import { loadLoggedDesigns } from "../../../../lib/agent/failure-store";
import { DatabaseNotConfigured, getDb } from "../../../../lib/db/client";
import { reportError } from "../../../../lib/observability";
import { requireAdmin } from "../../../../lib/require-admin";

/**
 * How well the design agent is doing over the last `?days=` days (default 7, up to 90): the share of designs whose
 * last version built, the ten most common failures with example requests, and draft benchmark cases from them.
 */
export async function GET(request: Request) {
  const who = await requireAdmin();
  if ("response" in who) return who.response;
  const days = Number(new URL(request.url).searchParams.get("days") ?? 7);
  if (!Number.isFinite(days) || days <= 0 || days > 90) return Response.json({ error: "days must be between 0 and 90." }, { status: 400 });
  try {
    const logged = await loadLoggedDesigns(await getDb(), new Date(Date.now() - days * 24 * 3600 * 1000));
    const failures = topFailures(logged, 10);
    return Response.json(
      { designs: logged.length, successRate: successRate(logged), failures, benchmarkCandidates: benchmarkCandidates(failures) },
      { headers: { "cache-control": "private, no-store" } },
    );
  } catch (error) {
    if (!(error instanceof DatabaseNotConfigured)) await reportError("database unavailable", error);
    return Response.json({ error: "The database is not available." }, { status: 503 });
  }
}
