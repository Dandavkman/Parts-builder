"use client";

import { useEffect, useRef, useState } from "react";
import { collectNumbers, type SpecNumber } from "../../lib/agent/spec-numbers";

const MAX_SLIDERS = 60;
const COMMIT_DELAY_MS = 300;
const OPEN_BELOW = 13;

/** "knob thickness_mm" -> "knob thickness", "r00 end_mm x" -> "r00 end x"; the unit has its own column. */
export function readableLabel(label: string): string {
  return label.replace(/_(mm|deg)\b/g, "").replace(/_/g, " ");
}

/** One slider and number box per `_mm` / `_deg` value in the spec. A change is sent after a short pause. */
export function Sliders({
  spec,
  disabled,
  onCommit,
}: {
  spec: Record<string, unknown>;
  disabled: boolean;
  onCommit: (item: SpecNumber, value: number) => void;
}) {
  const numbers = collectNumbers(spec);
  const [draft, setDraft] = useState<Record<string, number>>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // A new spec (after a rebuild, undo or reopening a design) replaces any unsent edits.
  useEffect(() => setDraft({}), [spec]);
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  function change(item: SpecNumber, value: number) {
    if (!Number.isFinite(value)) return;
    const key = item.path.join(".");
    setDraft((d) => ({ ...d, [key]: value }));
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => onCommit(item, value), COMMIT_DELAY_MS);
  }

  if (numbers.length === 0) return null;
  return (
    <details className="mt-2 text-xs" open={numbers.length < OPEN_BELOW}>
      <summary className="cursor-pointer text-muted">Adjust numbers ({numbers.length})</summary>
      <ul className="mt-1 max-h-48 space-y-1 overflow-y-auto" aria-label="Sliders">
        {numbers.slice(0, MAX_SLIDERS).map((item) => {
          const key = item.path.join(".");
          const value = draft[key] ?? item.value;
          return (
            <li key={key} className="flex items-center gap-2">
              <span className="w-40 shrink-0 truncate" title={readableLabel(item.label)}>
                {readableLabel(item.label)}
              </span>
              <input
                type="range"
                aria-label={item.label}
                min={Math.min(item.min, value)}
                max={Math.max(item.max, value)}
                step={item.step}
                value={value}
                disabled={disabled}
                onChange={(e) => change(item, Number(e.target.value))}
                className="min-w-0 flex-1"
              />
              <input
                type="number"
                aria-label={`${item.label} value`}
                step={item.step}
                value={value}
                disabled={disabled}
                onChange={(e) => change(item, Number(e.target.value))}
                className="w-20 rounded border border-line-strong bg-transparent px-1"
              />
              <span className="w-7 text-muted">{item.unit}</span>
            </li>
          );
        })}
      </ul>
      {numbers.length > MAX_SLIDERS && (
        <p className="mt-1 text-muted">Showing the first {MAX_SLIDERS} of {numbers.length} numbers.</p>
      )}
    </details>
  );
}
