import type { Metadata } from "next";
import { FAQ } from "../../lib/brand";
import { PublicShell } from "../public-shell";

export const metadata: Metadata = { title: "FAQ" };

export default function FaqPage() {
  return (
    <PublicShell title="Questions and answers">
      <dl className="mt-6 space-y-6">
        {FAQ.map((f) => (
          <div key={f.q}>
            <dt className="font-medium">{f.q}</dt>
            <dd className="mt-1 text-zinc-600 dark:text-zinc-400">{f.a}</dd>
          </div>
        ))}
      </dl>
    </PublicShell>
  );
}
