import { SiteHeader } from "../site-header";
import { PlateViewer } from "./plate-viewer";

export default function ViewerPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-6 py-8">
        <h1 className="text-2xl font-semibold">Viewer</h1>
        <p className="mt-1 text-sm text-muted">
          Demo plate, 50 x 30 x 4 mm with two 6.5 mm holes, built by the geometry service. Drag to
          orbit, scroll to zoom.
        </p>
        <div className="mt-6 h-[520px] overflow-hidden rounded border border-line">
          <PlateViewer />
        </div>
      </main>
    </>
  );
}
