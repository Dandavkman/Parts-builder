import Link from "next/link";
import { SiteHeader } from "./site-header";

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-6 py-20">
        <h1 className="text-4xl font-semibold tracking-tight">
          Scan your car. Describe the part. We make it.
        </h1>
        <p className="mt-4 text-lg text-zinc-600 dark:text-zinc-400">
          Design custom parts that fit your exact car, then order them printed in nylon, carbon
          fiber or metal.
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
