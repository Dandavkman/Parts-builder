import Link from "next/link";
import { SiteHeader } from "./site-header";

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-6 py-20">
        <h1 className="text-4xl font-semibold tracking-tight">
          Describe the part. We design it with you and make it.
        </h1>
        <p className="mt-4 text-lg text-zinc-600 dark:text-zinc-400">
          Start from a photo, published measurements or a 3D scan, refine the design in chat, then
          order it made.
        </p>
        <Link
          href="/dashboard"
          className="mt-8 inline-block rounded bg-zinc-900 px-5 py-2.5 text-white dark:bg-zinc-100 dark:text-zinc-900"
        >
          Open dashboard
        </Link>
      </main>
    </>
  );
}
