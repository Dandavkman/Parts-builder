import { desc } from "drizzle-orm";
import { viewerIsAdmin } from "../../../lib/admin/gate";
import { DatabaseNotConfigured, getDb } from "../../../lib/db/client";
import { waitlist } from "../../../lib/db/schema";
import { SiteHeader } from "../../site-header";

export const dynamic = "force-dynamic";

/** Admin: who is on the waitlist, with a CSV download. */
export default async function AdminWaitlist() {
  const allowed = await viewerIsAdmin();
  let rows: { email: string; createdAt: Date }[] = [];
  let unavailable = false;
  if (allowed) {
    try {
      rows = await (await getDb()).select().from(waitlist).orderBy(desc(waitlist.createdAt));
    } catch (error) {
      if (!(error instanceof DatabaseNotConfigured)) throw error;
      unavailable = true;
    }
  }
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="text-2xl font-semibold">Waitlist</h1>
        {!allowed ? (
          <p className="mt-4 text-sm">Admins only.</p>
        ) : unavailable ? (
          <p className="mt-4 text-sm">The database is not available.</p>
        ) : (
          <>
            <p className="mt-4 text-sm">
              {rows.length} {rows.length === 1 ? "person" : "people"}.{" "}
              <a href="/api/admin/waitlist?format=csv" className="underline">Download CSV</a>
            </p>
            <ul className="mt-4 divide-y divide-line text-sm">
              {rows.map((r) => (
                <li key={r.email} className="flex justify-between gap-4 py-2">
                  <span>{r.email}</span>
                  <span className="text-muted">{r.createdAt.toISOString().slice(0, 10)}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </main>
    </>
  );
}
