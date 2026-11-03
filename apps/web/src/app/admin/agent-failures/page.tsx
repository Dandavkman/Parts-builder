import { viewerIsAdmin } from "../../../lib/admin/gate";
import { agentReport } from "../../../lib/agent/failure-store";
import { getDb } from "../../../lib/db/client";
import { SiteHeader } from "../../site-header";

export const dynamic = "force-dynamic";

const DAYS = 7;

/** How well the design agent did over the last week: success rate and the most common failures (admin). */
export default async function AdminAgentFailures() {
  const allowed = await viewerIsAdmin();
  let report: Awaited<ReturnType<typeof agentReport>> | null = null;
  let problem: string | null = null;
  if (allowed) {
    try {
      report = await agentReport(await getDb(), DAYS);
    } catch {
      problem = "The database is not available.";
    }
  }
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="text-2xl font-semibold">Design agent failures (admin)</h1>
        {!allowed ? (
          <p className="mt-4 text-sm">Admins only.</p>
        ) : (
          <>
            {problem && <p className="mt-4 text-sm text-warning-text">{problem}</p>}
            {report && (
              <>
                <p className="mt-2 text-sm text-muted">
                  Last {DAYS} days: {report.designs} designs, {(report.successRate * 100).toFixed(1)}% built on the last try.
                </p>
                {report.failures.length === 0 && <p className="mt-4 text-sm text-muted">No failures logged.</p>}
                <ul className="mt-4 space-y-3" aria-label="Failures">
                  {report.failures.map((f) => (
                    <li key={f.reason} className="rounded border border-line p-3 text-sm">
                      <p className="font-medium">
                        {f.reason} <span className="font-normal text-muted">({f.count})</span>
                      </p>
                      {f.examples.map((e) => (
                        <p key={e} className="mt-1 text-muted">&ldquo;{e}&rdquo;</p>
                      ))}
                    </li>
                  ))}
                </ul>
                {report.benchmarkCandidates.length > 0 && (
                  <p className="mt-4 text-xs text-muted">{report.benchmarkCandidates.length} draft benchmark cases are available from /api/admin/agent-failures.</p>
                )}
              </>
            )}
          </>
        )}
      </main>
    </>
  );
}
