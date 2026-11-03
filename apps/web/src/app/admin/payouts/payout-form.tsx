"use client";

import { useState } from "react";
import { dollarsToCents, recordPayoutAction } from "../../../lib/admin/decisions";
import { useDecision } from "../use-decision";

/** Record a payout you already sent to one seller. The reference (bank or transfer id) makes it count once. */
export function PayoutForm({ storeId }: { storeId: string }) {
  const d = useDecision();
  const [amount, setAmount] = useState("");
  const [ref, setRef] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  function submit() {
    const cents = dollarsToCents(amount);
    if (cents === null) return setProblem("Enter the amount in dollars.");
    setProblem(null);
    void d.run(() => recordPayoutAction({ storeId, amountCents: cents, ref }));
  }
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
      <input aria-label="Amount in dollars" className="w-28 rounded border border-line-strong bg-page px-2 py-1" placeholder="Amount ($)" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
      <input aria-label="Payout reference" className="w-44 rounded border border-line-strong bg-page px-2 py-1" placeholder="Bank or transfer ref" value={ref} onChange={(e) => setRef(e.target.value)} maxLength={100} />
      <button type="button" disabled={d.busy} onClick={submit} className="rounded bg-primary px-3 py-1 text-on-primary disabled:opacity-60">
        Record payout
      </button>
      {(problem ?? d.error) && <p className="w-full text-danger" role="alert">{problem ?? d.error}</p>}
    </div>
  );
}
