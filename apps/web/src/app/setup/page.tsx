import { getAuthMode } from "../../lib/auth-mode";

export default function SetupPage() {
  const dev = process.env.NODE_ENV === "development";
  return (
    <main className="mx-auto max-w-2xl px-6 py-20">
      <h1 className="text-2xl font-semibold">Sign-in is not set up</h1>
      {dev ? (
        <>
          <p className="mt-3 text-zinc-600 dark:text-zinc-400">
            Add your Clerk development keys to <code>apps/web/.env.local</code>, then restart the
            dev server:
          </p>
          <pre className="mt-4 overflow-x-auto rounded bg-zinc-100 p-4 text-sm dark:bg-zinc-900">
{`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...`}
          </pre>
          <p className="mt-4 text-zinc-600 dark:text-zinc-400">
            To work on pages without Clerk, set <code>ALLOW_UNAUTHENTICATED_DEV=true</code> in the
            same file. This only works in development mode.
          </p>
        </>
      ) : (
        <p className="mt-3 text-zinc-600 dark:text-zinc-400">
          This site is not available right now.
        </p>
      )}
      <p className="mt-6 text-xs text-zinc-500">Auth mode: {getAuthMode()}</p>
    </main>
  );
}
