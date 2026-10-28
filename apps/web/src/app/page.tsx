import Link from "next/link";
import { BRAND, STEPS } from "../lib/brand";
import { PublicShell } from "./public-shell";
import { WaitlistForm } from "./waitlist-form";

export default function Home() {
  return (
    <PublicShell>
      <h1 className="text-4xl font-semibold tracking-tight">{BRAND.tagline}</h1>
      <p className="mt-4 text-lg text-zinc-600 dark:text-zinc-400">
        Start from a photo, published measurements or a 3D scan, refine the design in chat, then order it made.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/design" className="rounded bg-zinc-900 px-5 py-2.5 text-white dark:bg-zinc-100 dark:text-zinc-900">
          Start a design
        </Link>
        <Link href="/dashboard" className="rounded border border-zinc-300 px-5 py-2.5 dark:border-zinc-700">
          My dashboard
        </Link>
      </div>

      <h2 className="mt-14 text-2xl font-semibold">How it works</h2>
      <ol className="mt-4 space-y-5">
        {STEPS.map((s, i) => (
          <li key={s.title} className="flex gap-4">
            <span aria-hidden className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900">
              {i + 1}
            </span>
            <div>
              <h3 className="font-medium">{s.title}</h3>
              <p className="text-zinc-600 dark:text-zinc-400">{s.body}</p>
            </div>
          </li>
        ))}
      </ol>

      <h2 className="mt-14 text-2xl font-semibold">Get told when ordering opens</h2>
      <p className="mt-2 text-zinc-600 dark:text-zinc-400">Designing is open now. Ordering is coming soon.</p>
      <WaitlistForm />
    </PublicShell>
  );
}
