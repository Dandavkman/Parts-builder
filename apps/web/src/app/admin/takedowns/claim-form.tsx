"use client";

import { useState } from "react";
import { decideTakedown } from "../../../lib/admin/decisions";
import { useDecision } from "../use-decision";

/** Decision buttons for one takedown claim. A new claim is removed or dismissed; a counter-notice is restored or upheld. */
export function ClaimForm({ claimId, counter }: { claimId: string; counter: boolean }) {
  const d = useDecision();
  const [note, setNote] = useState("");
  const options = counter ? (["restore", "uphold"] as const) : (["remove", "dismiss"] as const);
  return (
    <div className="mt-3 space-y-2 text-sm">
      <input className="w-full rounded border border-line-strong bg-page px-3 py-2" placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
      {d.error && <p className="text-danger" role="alert">{d.error}</p>}
      <div className="flex gap-2">
        {options.map((o, i) => (
          <button key={o} type="button" disabled={d.busy} onClick={() => void d.run(() => decideTakedown(claimId, o, note))} className={i === 0 ? "rounded bg-primary px-3 py-1 text-on-primary disabled:opacity-60" : "rounded border border-line-strong px-3 py-1 disabled:opacity-60"}>
            {o[0].toUpperCase() + o.slice(1)}
          </button>
        ))}
      </div>
    </div>
  );
}
