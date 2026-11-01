import Link from "next/link";
import { viewerIsAdmin } from "../../lib/admin/gate";
import { SiteHeader } from "../site-header";

export const dynamic = "force-dynamic";

const SECTIONS = [
  { href: "/admin/orders", title: "Orders", hint: "Move orders along, job sheets, packing slips." },
  { href: "/admin/listings", title: "Listings to review", hint: "Approve or reject store listings." },
  { href: "/admin/takedowns", title: "Takedown claims", hint: "Decide new claims and counter-notices." },
  { href: "/admin/waitlist", title: "Waitlist", hint: "Who signed up, with a CSV download." },
];

/** The admin console: where each admin screen lives. */
export default async function AdminHome() {
  const allowed = await viewerIsAdmin();
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="text-2xl font-semibold">Admin</h1>
        {!allowed ? (
          <p className="mt-4 text-sm">Admins only.</p>
        ) : (
          <ul className="mt-6 space-y-3">
            {SECTIONS.map((s) => (
              <li key={s.href} className="rounded border border-line p-3">
                <Link href={s.href} className="font-medium underline">
                  {s.title}
                </Link>
                <p className="text-sm text-muted">{s.hint}</p>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}
