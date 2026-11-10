"use client";

import type { ChatItem } from "../../lib/agent/chat-state";
import { useOpenFlag } from "./use-open-flag";
import { useStickToBottom } from "./use-stick-to-bottom";

/** The command stream: tool calls, build attempts and checks, under the viewer. Collapsible, and it follows the newest line. */
export function ActivityLog({ items, busy }: { items: ChatItem[]; busy: boolean }) {
  const [open, toggle] = useOpenFlag("design.activity.open", true);
  const scroll = useStickToBottom<HTMLUListElement>(items.length);
  if (items.length === 0 && !busy) return null;
  const last = items.at(-1)?.text;
  return (
    <section className="mt-2 rounded border border-line" aria-label="Activity">
      <button type="button" onClick={toggle} aria-expanded={open} className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs">
        <span aria-hidden className="text-contrast">{open ? "▾" : "▸"}</span>
        <span className="font-caps uppercase tracking-widest text-contrast">Activity</span>
        <span className="text-muted">({items.length})</span>
        {busy && <span className="text-muted">working…</span>}
        {!open && last && <span className="min-w-0 flex-1 truncate text-muted">{last}</span>}
      </button>
      {open && (
        <ul ref={scroll.ref} onScroll={scroll.onScroll} className="max-h-36 space-y-0.5 overflow-y-auto border-t border-line px-3 py-2 font-mono text-xs text-muted">
          {items.map((item, i) => (
            <li key={i} className="whitespace-pre-wrap break-words">{item.text}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
