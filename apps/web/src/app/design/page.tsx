import { SiteHeader } from "../site-header";
import { Workspace } from "./workspace";

export default function DesignPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-6 py-6">
        <h1 className="text-2xl font-semibold">Design a part</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Describe a part in words, and add a photo to start from. Give one real measurement (or put
          a card or coin next to it) so the agent can get the size right. Designs that need a car scan
          use a stand-in panel until scans are connected.
        </p>
        <Workspace />
      </main>
    </>
  );
}
