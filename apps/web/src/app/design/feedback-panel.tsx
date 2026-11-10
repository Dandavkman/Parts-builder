"use client";

import { statusLabel } from "../../lib/feedback/client";
import { useFeedback } from "./use-feedback";
import { useOpenFlag } from "./use-open-flag";

/** Optional collapsible panel: testers tell us what is wrong or missing, tied to the design they are on. */
export function FeedbackPanel({ designId }: { designId: string | null }) {
  const f = useFeedback(designId);
  const [open, toggle] = useOpenFlag("design.feedback.open", false);
  return (
    <section className="mt-2 rounded border border-line text-sm" aria-label="Feedback">
      <button type="button" onClick={toggle} aria-expanded={open} className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs">
        <span aria-hidden className="text-accent">{open ? "▾" : "▸"}</span>
        <span className="font-caps uppercase tracking-widest text-accent">Feedback</span>
        {!open && <span className="text-muted">Tell us what is wrong or missing</span>}
      </button>
      {open && (
        <div className="max-h-72 space-y-3 overflow-y-auto border-t border-line p-3">
      <p className="text-muted">Found a problem or something missing? Tell us. We read every comment, and the ones we approve get worked on.</p>
      {!f.canSend ? (
        <p className="rounded border border-line p-3 text-muted">Start a design first, so we know what you were looking at.</p>
      ) : (
        <div className="space-y-2">
          <textarea
            className="min-h-28 w-full rounded border border-line-strong bg-page px-3 py-2"
            aria-label="Your feedback"
            placeholder="What went wrong, or what would make this better?"
            value={f.text}
            onChange={(e) => f.setText(e.target.value)}
            maxLength={2000}
          />
          {f.error && <p className="text-danger" role="alert">{f.error}</p>}
          {f.sent && <p className="text-muted" role="status">Thanks, we got it.</p>}
          <button type="button" disabled={f.busy} onClick={() => void f.submit()} className="rounded bg-primary px-3 py-1 text-on-primary disabled:opacity-60">
            Send feedback
          </button>
        </div>
      )}
      {f.items.length > 0 && (
        <ul className="divide-y divide-line rounded border border-line" aria-label="Your feedback on this design">
          {f.items.map((i) => (
            <li key={i.id} className="p-3">
              <p className="whitespace-pre-wrap">{i.body}</p>
              <p className="mt-1 text-xs text-muted">{statusLabel(i.status)}</p>
            </li>
          ))}
        </ul>
      )}
        </div>
      )}
    </section>
  );
}
