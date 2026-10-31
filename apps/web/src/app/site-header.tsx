import { Show, UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { getAuthMode } from "../lib/auth-mode";
import { BRAND } from "../lib/brand";

export function SiteHeader({ wide }: { wide?: boolean } = {}) {
  const mode = getAuthMode();
  return (
    <header className={`mx-auto flex ${wide ? "max-w-5xl" : "max-w-3xl"} flex-wrap items-center justify-between gap-x-4 gap-y-2 px-6 py-4 sm:py-5`}>
      <Link href="/" className="font-caps text-sm uppercase tracking-[0.22em]">
        {BRAND.name}
      </Link>
      <nav className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-subtle sm:gap-5">
        <Link href="/#how-it-works" className="hidden hover:underline sm:inline">
          How it works
        </Link>
        <Link href="/pricing" className="hover:underline">
          Pricing
        </Link>
        <Link href="/faq" className="hover:underline">
          FAQ
        </Link>
        {mode === "clerk" ? (
          <>
            <Show when="signed-in">
              <Link href="/dashboard" className="hover:underline">
                Dashboard
              </Link>
              <Link href="/design" className="hover:underline">
                Design
              </Link>
              <UserButton />
            </Show>
            <Show when="signed-out">
              <Link href="/sign-in" className="hover:underline">
                Sign in
              </Link>
            </Show>
          </>
        ) : (
          <span className="rounded bg-warning-soft px-2 py-1 text-xs text-warning-ink">
            {mode === "dev-bypass" ? "Dev mode: no sign-in" : "Sign-in not set up"}
          </span>
        )}
      </nav>
    </header>
  );
}
