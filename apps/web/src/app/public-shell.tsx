import Link from "next/link";
import type { ReactNode } from "react";
import { BRAND } from "../lib/brand";
import { Backdrop } from "./backdrop";
import { SiteHeader } from "./site-header";

/** Backdrop, header, content column and footer shared by the public pages. `wide` lets the home page use the full width. */
export function PublicShell({ title, wide, children }: { title?: string; wide?: boolean; children: ReactNode }) {
  const width = wide ? "max-w-5xl" : "max-w-3xl";
  return (
    <div className="relative overflow-x-clip">
      <Backdrop />
      <div className="relative z-10">
        <div className="sticky top-0 z-20 border-b border-line bg-page/80 backdrop-blur-md">
          <SiteHeader wide={wide} />
        </div>
        <main className={`mx-auto ${width} px-6 py-14`}>
          {title && <h1 className="font-display text-4xl font-medium tracking-tight">{title}</h1>}
          {children}
        </main>
        <footer className={`mx-auto ${width} border-t border-line px-6 py-6 text-sm text-subtle`}>
          <nav className="flex flex-wrap gap-4" aria-label="Footer">
            <Link href="/pricing" className="hover:underline">Pricing</Link>
            <Link href="/faq" className="hover:underline">FAQ</Link>
            <Link href="/terms" className="hover:underline">Terms</Link>
            <Link href="/privacy" className="hover:underline">Privacy</Link>
          </nav>
          <p className="mt-2">{BRAND.name}. Questions: {BRAND.contactEmail}</p>
        </footer>
      </div>
    </div>
  );
}
