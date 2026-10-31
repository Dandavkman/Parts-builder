import { BRAND, ETYMOLOGY, STEPS } from "../lib/brand";
import { IdeaToProduct } from "./idea-to-product";
import { PublicShell } from "./public-shell";
import { WaitlistForm } from "./waitlist-form";

export default function Home() {
  return (
    <PublicShell wide>
      <div className="rise grid justify-items-center gap-0 pt-8 text-center">
        <h1 className="font-display text-[clamp(56px,10vw,104px)] font-normal leading-none tracking-tight">{BRAND.name}</h1>
        <p className="mt-5 font-caps text-[clamp(15px,2.2vw,20px)] uppercase tracking-[0.3em] text-accent">
          From the Greek <span className="font-greek text-[1.5em] normal-case italic tracking-[0.04em]">{ETYMOLOGY.greek}</span>
        </p>
        <p className="mt-3 font-display text-[clamp(22px,3vw,30px)] text-subtle">{ETYMOLOGY.meaning}</p>
        <ol className="mt-5 grid gap-2 text-left font-display text-[clamp(19px,2.4vw,23px)] leading-snug text-subtle">
          {ETYMOLOGY.senses.map((sense, i) => (
            <li key={sense} className="grid grid-cols-[1.6em_1fr] gap-1">
              <b className="pt-[0.5em] font-caps text-xs font-medium tracking-widest text-accent">{i + 1}.</b>
              <span>{sense}</span>
            </li>
          ))}
        </ol>
        <div className="mt-8 flex w-full justify-center">
          <WaitlistForm />
        </div>
        <p className="mt-3 text-sm text-subtle">
          Designing is open now. Ordering opens soon. <a href="#how-it-works" className="underline">See how it works</a>
        </p>
      </div>

      <div className="mt-14 flex justify-center">
        <IdeaToProduct />
      </div>

      <section id="how-it-works" className="scroll-mt-16 pt-24 pb-10">
        <h2 className="text-center font-display text-[clamp(32px,5vw,48px)] font-normal">From idea to part in six steps</h2>
        <p className="mx-auto mt-2 mb-11 max-w-prose text-center text-subtle">Start with a photo and a sentence. End with a part in your hands. Every step is yours to change.</p>
        <ol className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(270px,1fr))]">
          {STEPS.map((s, i) => (
            <li key={s.title} className="min-w-0 rounded-sm border border-line bg-card p-6 backdrop-blur-sm">
              <span className="font-caps text-xs uppercase tracking-[0.3em] text-accent">Step {i + 1}</span>
              <h3 className="mt-2 mb-2 font-display text-2xl font-medium leading-tight">{s.title}</h3>
              <p className="text-[15px] text-subtle">{s.body}</p>
              {s.options && (
                <ul className="mt-3 grid gap-2 text-[15px]">
                  {s.options.map((o) => (
                    <li key={o} className="flex gap-2">
                      <span aria-hidden className="text-accent">•</span>
                      <span>{o}</span>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ol>
      </section>

      <div className="py-12 text-center">
        <div aria-hidden className="meander mx-auto max-w-60" />
        <p className="mt-4 font-display text-2xl italic text-subtle">Your idea, in your hands.</p>
      </div>
    </PublicShell>
  );
}
