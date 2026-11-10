"use client";

import type { Workspace } from "./use-workspace";

/** New-design button, the earlier-designs picker and any notice. */
export function DesignToolbar({ w }: { w: Workspace }) {
  const { chat, designs, newDesign, loadDesign, notice } = w;
  return (
    <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
      <button type="button" onClick={newDesign} disabled={chat.busy} className="rounded border border-line-strong px-3 py-1 disabled:opacity-40">
        New design
      </button>
      {designs.length > 0 && (
        <select
          aria-label="Earlier designs"
          value={chat.designId ?? ""}
          disabled={chat.busy}
          onChange={(e) => e.target.value && void loadDesign(e.target.value, true)}
          className="max-w-xs rounded border border-line-strong bg-transparent px-2 py-1"
        >
          <option value="">Earlier designs...</option>
          {designs.map((d) => (
            <option key={d.id} value={d.id}>
              {d.title}
            </option>
          ))}
        </select>
      )}
      {notice && <span className="text-danger">{notice}</span>}
    </div>
  );
}
