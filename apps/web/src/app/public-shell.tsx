import Link from "next/link";
import type { ReactNode } from "react";
import { BRAND } from "../lib/brand";
import { SiteHeader } from "./site-header";

/** Header, content column and footer shared by the public pages. */
export function PublicShell({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-6 py-14">
        {title && <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>}
        {children}
      </main>
      <footer className="mx-auto max-w-3xl border-t border-line px-6 py-6 text-sm text-muted">
        <nav className="flex flex-wrap gap-4" aria-label="Footer">
          <Link href="/pricing" className="hover:underline">Pricing</Link>
          <Link href="/faq" className="hover:underline">FAQ</Link>
          <Link href="/terms" className="hover:underline">Terms</Link>
          <Link href="/privacy" className="hover:underline">Privacy</Link>
        </nav>
        <p className="mt-2">{BRAND.name}. Questions: {BRAND.contactEmail}</p>
      </footer>
    </>
  );
}
