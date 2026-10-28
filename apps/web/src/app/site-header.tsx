import { Show, UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { getAuthMode } from "../lib/auth-mode";

export function SiteHeader() {
  const mode = getAuthMode();
  return (
    <header className="flex items-center justify-between border-b border-line px-6 py-3">
      <Link href="/" className="font-semibold tracking-tight">
        Parts Builder
      </Link>
      <nav className="flex items-center gap-5 text-sm">
        <Link href="/dashboard" className="hover:underline">
          Dashboard
        </Link>
        <Link href="/design" className="hover:underline">
          Design
        </Link>
        <Link href="/viewer" className="hover:underline">
          Viewer
        </Link>
        {mode === "clerk" ? (
          <>
            <Show when="signed-in">
              <UserButton />
            </Show>
            <Show when="signed-out">
              <Link href="/sign-in" className="rounded bg-primary px-3 py-1.5 text-on-primary">
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
