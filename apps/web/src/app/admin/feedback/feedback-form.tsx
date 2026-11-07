"use client";

import { useState } from "react";
import { decideFeedbackAction } from "../../../lib/admin/decisions";
import { useDecision } from "../use-decision";

/** Approve / Reject buttons for one comment. `retry` is for an approved comment the agent never received. */
export function FeedbackForm({ id, retry }: { id: string; retry: boolean }) {
  const d = useDecision();
  const [note, setNote] = useState("");
  return (
    <div className="mt-3 space-y-2 text-sm">
      {!retry && <input className="w-full rounded border border-line-strong bg-page px-3 py-2" placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />}
      {d.error && <p className="text-danger" role="alert">{d.error}</p>}
      <div className="flex gap-2">
        <button type="button" disabled={d.busy} onClick={() => void d.run(() => decideFeedbackAction(id, "approve", note))} className="rounded bg-primary px-3 py-1 text-on-primary disabled:opacity-60">
          {retry ? "Send to agent again" : "Approve"}
        </button>
        {!retry && (
          <button type="button" disabled={d.busy} onClick={() => void d.run(() => decideFeedbackAction(id, "reject", note))} className="rounded border border-line-strong px-3 py-1 disabled:opacity-60">
            Reject
          </button>
        )}
      </div>
    </div>
  );
}
