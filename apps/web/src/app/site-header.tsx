import { Show, UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { getAuthMode } from "../lib/auth-mode";

export function SiteHeader() {
  const mode = getAuthMode();
  return (
    <header className="flex items-center justify-between border-b border-zinc-200 px-6 py-3 dark:border-zinc-800">
      <Link href="/" className="font-semibold tracking-tight">
        Parts Builder
      </Link>
      <nav className="flex items-center gap-5 text-sm">
        <Link href="/dashboard" className="hover:underline">
          Dashboard
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
              <Link href="/sign-in" className="rounded bg-zinc-900 px-3 py-1.5 text-white dark:bg-zinc-100 dark:text-zinc-900">
                Sign in
              </Link>
            </Show>
          </>
        ) : (
          <span className="rounded bg-amber-100 px-2 py-1 text-xs text-amber-900">
            {mode === "dev-bypass" ? "Dev mode: no sign-in" : "Sign-in not set up"}
          </span>
        )}
      </nav>
    </header>
  );
}
