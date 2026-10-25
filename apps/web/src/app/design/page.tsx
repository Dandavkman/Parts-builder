import { SiteHeader } from "../site-header";
import { Workspace } from "./workspace";

export default function DesignPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-6 py-6">
        <h1 className="text-2xl font-semibold">Design a part</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Describe a part in words. The agent builds it on a stand-in panel with two 8 mm holes 80 mm
          apart until scans are connected.
        </p>
        <Workspace />
      </main>
    </>
  );
}
