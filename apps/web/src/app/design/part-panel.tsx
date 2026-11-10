"use client";

import { ModelViewer } from "../viewer/plate-viewer";
import { OrderPanel } from "./order-panel";
import { Sliders } from "./sliders";
import type { Workspace } from "./use-workspace";

const PART_ERROR =
  "Could not load the part. The geometry service may be waking up (up to 40 seconds); send another message or reload.";

/** The 3D part, downloads, values found online, known sizes, sliders, ordering and the version list. */
export function PartPanel({ w }: { w: Workspace }) {
  const { chat, partUrl, current, downloadUrl, pending, edits, setEdits, answerSuggestion, dimensions, spec, commitSlider, designId, versions, useVersion } = w;
  return (
    <section className="flex h-[560px] flex-col">
      <div className="min-h-0 flex-1 overflow-hidden rounded border border-line">
        {partUrl ? (
          <ModelViewer url={partUrl} errorMessage={PART_ERROR} />
        ) : (
          <div className="flex h-full items-center justify-center p-6 text-center text-sm text-muted">
            The part will appear here once the agent has built one.
          </div>
        )}
      </div>
      {partUrl && (
        <div className="mt-2 flex gap-3 text-sm">
          <span className="text-muted">Download version {current}:</span>
          <a className="underline" href={downloadUrl("step")}>STEP</a>
          <a className="underline" href={downloadUrl("stl")}>STL</a>
        </div>
      )}
      {pending.length > 0 && (
        <ul className="mt-2 space-y-1 rounded border border-warning-line p-2 text-xs" aria-label="Found online">
          {pending.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center gap-2">
              <span>Found online: {d.id} =</span>
              <input
                type="number"
                min={0}
                aria-label={`${d.id} in millimeters`}
                value={edits[d.id] ?? String(d.value_mm)}
                onChange={(e) => setEdits((s) => ({ ...s, [d.id]: e.target.value }))}
                className="w-20 rounded border border-line-strong bg-transparent px-1 py-0.5"
              />
              <span>mm</span>
              {d.source_url && (
                <a className="underline" href={d.source_url} target="_blank" rel="noreferrer noopener">
                  source
                </a>
              )}
              <button type="button" onClick={() => void answerSuggestion(d, "confirm")} disabled={chat.busy} className="rounded bg-primary px-2 py-0.5 text-on-primary disabled:opacity-40">
                Confirm
              </button>
              <button type="button" onClick={() => void answerSuggestion(d, "reject")} disabled={chat.busy} className="underline disabled:opacity-40">
                Not right
              </button>
            </li>
          ))}
        </ul>
      )}
      {dimensions.length > 0 && (
        <ul className="mt-2 space-y-0.5 text-xs" aria-label="Known sizes">
          {dimensions.map((d) => (
            <li key={d.id} className="text-muted">
              {d.id}: {d.value_mm} mm ({d.confidence === "stated" ? "from you" : d.confidence === "estimated" ? "estimated from a photo, please check" : "published"})
            </li>
          ))}
        </ul>
      )}
      {spec && <Sliders spec={spec} disabled={chat.busy} onCommit={(item, value) => void commitSlider(item, value)} />}
      {designId && <OrderPanel key={`${designId}-${current}`} designId={designId} version={current} />}
      {versions.length > 0 && (
        <ul className="mt-2 max-h-28 space-y-1 overflow-y-auto text-xs" aria-label="Versions">
          {[...versions].reverse().map((v) => (
            <li key={v.version} className="flex items-center gap-2">
              <span className={v.version === current ? "font-semibold" : "text-muted"}>
                v{v.version} {v.name} ({v.createdBy}, {v.buildOk ? "built" : "did not build"})
              </span>
              {v.buildOk && v.version !== current && (
                <button type="button" onClick={() => void useVersion(v.version)} disabled={chat.busy} className="underline disabled:opacity-40">
                  Use this version
                </button>
              )}
              {v.version === current && <span className="text-muted">showing</span>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
