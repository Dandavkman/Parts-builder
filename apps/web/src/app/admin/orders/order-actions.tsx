"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { statusLabel } from "../../../lib/dashboard";

/** Move one order to its next status. `next` is the list of statuses the flow allows from here. */
export function OrderActions({ orderId, next }: { orderId: string; next: string[] }) {
  const router = useRouter();
  const [status, setStatus] = useState(next[0] ?? "");
  const [tracking, setTracking] = useState("");
  const [partnerRef, setPartnerRef] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  if (next.length === 0) return null;

  async function apply() {
    setMessage(null);
    const response = await fetch(`/api/admin/orders/${orderId}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status, trackingNumber: tracking, partnerOrderRef: partnerRef }),
    }).catch(() => null);
    const data = (await response?.json().catch(() => null)) as { error?: string } | null;
    if (!response?.ok) {
      setMessage(data?.error ?? "Could not change the status.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
      <select aria-label="New status" value={status} onChange={(e) => setStatus(e.target.value)} className="rounded border border-zinc-300 bg-transparent px-1 py-0.5 dark:border-zinc-700">
        {next.map((s) => (
          <option key={s} value={s}>
            {statusLabel(s)}
          </option>
        ))}
      </select>
      <input aria-label="Partner order reference" placeholder="Partner order ref" value={partnerRef} onChange={(e) => setPartnerRef(e.target.value)} className="w-36 rounded border border-zinc-300 bg-transparent px-1 py-0.5 dark:border-zinc-700" />
      <input aria-label="Tracking number" placeholder="Tracking number" value={tracking} onChange={(e) => setTracking(e.target.value)} className="w-36 rounded border border-zinc-300 bg-transparent px-1 py-0.5 dark:border-zinc-700" />
      <button type="button" onClick={() => void apply()} className="rounded border border-zinc-300 px-2 py-0.5 dark:border-zinc-700">
        Apply
      </button>
      {message && <span role="status">{message}</span>}
    </div>
  );
}
