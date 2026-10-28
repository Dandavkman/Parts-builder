"use client";

import { useState } from "react";
import { decideListing } from "../../../lib/admin/decisions";
import { useDecision } from "../use-decision";

/** The review controls for one pending listing: the two checks, an optional note, approve and reject. */
export function ReviewForm({ listingId }: { listingId: string }) {
  const d = useDecision();
  const [copy, setCopy] = useState(false);
  const [mark, setMark] = useState(false);
  const [note, setNote] = useState("");
  return (
    <div className="mt-3 space-y-2 text-sm">
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={copy} onChange={(e) => setCopy(e.target.checked)} /> Not a copy of a factory part
      </label>
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={mark} onChange={(e) => setMark(e.target.checked)} /> No trademark
      </label>
      <input className="w-full rounded border border-line-strong bg-page px-3 py-2" placeholder="Note (required to reject; the seller sees it)" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
      {d.error && <p className="text-danger" role="alert">{d.error}</p>}
      <div className="flex gap-2">
        <button type="button" disabled={d.busy} className="rounded bg-primary px-3 py-1 text-on-primary disabled:opacity-60" onClick={() => void d.run(() => decideListing(listingId, { decision: "approve", note, notFactoryCopy: copy, noTrademark: mark }))}>
          Approve
        </button>
        <button type="button" disabled={d.busy} className="rounded border border-line-strong px-3 py-1 disabled:opacity-60" onClick={() => void d.run(() => decideListing(listingId, { decision: "reject", note }))}>
          Reject
        </button>
      </div>
    </div>
  );
}
