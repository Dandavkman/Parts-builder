import { viewerIsAdmin } from "../../../lib/admin/gate";
import { getDb } from "../../../lib/db/client";
import { feedbackQueue } from "../../../lib/feedback/feedback";
import { SiteHeader } from "../../site-header";
import { FeedbackForm } from "./feedback-form";

export const dynamic = "force-dynamic";

/** Tester feedback waiting for a decision, plus approved comments the agent has not received yet (admin). */
export default async function AdminFeedback() {
  const allowed = await viewerIsAdmin();
  let queue: Awaited<ReturnType<typeof feedbackQueue>> = [];
  let stuck: typeof queue = [];
  let problem: string | null = null;
  if (allowed) {
    try {
      const db = await getDb();
      queue = await feedbackQueue(db, "new");
      stuck = (await feedbackQueue(db, "approved")).filter((r) => !r.issueUrl);
    } catch {
      problem = "The database is not available.";
    }
  }
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="text-2xl font-semibold">Tester feedback (admin)</h1>
        {!allowed ? (
          <p className="mt-4 text-sm">Admins only.</p>
        ) : (
          <>
            {problem && <p className="mt-4 text-sm text-warning-text">{problem}</p>}
            {!problem && queue.length === 0 && stuck.length === 0 && <p className="mt-4 text-sm text-muted">Nothing waiting.</p>}
            <ul className="mt-4 space-y-3" aria-label="Feedback">
              {[...stuck, ...queue].map((r) => (
                <li key={r.id} className="rounded border border-line p-3 text-sm">
                  <p className="whitespace-pre-wrap">{r.body}</p>
                  <p className="mt-1 text-xs text-muted">
                    {r.createdAt.toISOString().slice(0, 10)} · design {r.designId ?? "deleted"}
                  </p>
                  {r.dispatchError && <p className="mt-1 text-xs text-warning-text">{r.dispatchError}</p>}
                  <FeedbackForm id={r.id} retry={r.status === "approved"} />
                </li>
              ))}
            </ul>
          </>
        )}
      </main>
    </>
  );
}
