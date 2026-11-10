import { SiteHeader } from "../site-header";
import { Workspace } from "./workspace";

export default function DesignPage() {
  return (
    <>
      <SiteHeader wide />
      <main className="mx-auto flex w-full max-w-[1800px] flex-col px-4 pb-4 lg:h-[calc(100dvh-4.75rem)]">
        <div className="meander" aria-hidden />
        <h1 className="mt-2 font-caps text-sm uppercase tracking-[0.25em] text-accent">Design a part</h1>
        <p className="mt-1 text-xs text-muted">
          Describe a part and add a photo to start from. Give one real measurement (or put a card or coin next to it) so the agent can get the size right.
        </p>
        <Workspace />
      </main>
    </>
  );
}
