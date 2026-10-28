import type { Metadata } from "next";
import { PublicShell } from "../public-shell";
import { WaitlistForm } from "../waitlist-form";

export const metadata: Metadata = { title: "Pricing" };

export default function PricingPage() {
  return (
    <PublicShell title="Pricing">
      <p className="mt-4 text-zinc-600 dark:text-zinc-400">
        Designing is free to try. When you want a part made, you see a price from each manufacturer for your exact part, material and
        quantity before you pay. That price already includes our fee, shipping and card processing.
      </p>
      <p className="mt-4 text-zinc-600 dark:text-zinc-400">
        Plans with more AI messages, more saved designs and STEP file export are coming. Prices will be listed here before they start.
      </p>
      <h2 className="mt-10 text-xl font-semibold">Hear when it opens</h2>
      <WaitlistForm />
    </PublicShell>
  );
}
