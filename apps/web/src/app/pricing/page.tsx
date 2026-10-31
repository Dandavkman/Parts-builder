import type { Metadata } from "next";
import { PublicShell } from "../public-shell";
import { WaitlistForm } from "../waitlist-form";

export const metadata: Metadata = { title: "Pricing" };

const POINTS = [
  { title: "Designing", body: "Free to try. Describe the part, adjust it in chat and with sliders, and download your own designs." },
  { title: "Making a part", body: "You see a price from each manufacturer for your exact part, material and quantity before you pay. That price already includes our fee, shipping and card processing." },
  { title: "Plans", body: "Plans with more AI messages, more saved designs and STEP file export are coming. Prices will be listed here before they start." },
];

export default function PricingPage() {
  return (
    <PublicShell wide>
      <h1 className="text-center font-display text-[clamp(40px,6vw,64px)] font-normal leading-tight">Pricing</h1>
      <p className="mx-auto mt-3 max-w-prose text-center text-lg text-subtle">Free to design. You see the full price before you pay for anything.</p>
      <ul className="mt-12 grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(270px,1fr))]">
        {POINTS.map((p) => (
          <li key={p.title} className="min-w-0 rounded-sm border border-line bg-card p-6 backdrop-blur-sm">
            <h2 className="font-display text-2xl font-medium">{p.title}</h2>
            <p className="mt-2 text-[15px] text-subtle">{p.body}</p>
          </li>
        ))}
      </ul>
      <section className="mt-16 grid justify-items-center gap-4 text-center">
        <h2 className="font-display text-3xl font-normal">Hear when it opens</h2>
        <WaitlistForm />
      </section>
    </PublicShell>
  );
}
