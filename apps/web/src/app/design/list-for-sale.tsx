"use client";

import { formatCents } from "../../lib/quotes/engine";
import type { QuoteView } from "./order-panel-logic";
import { useListForSale } from "./use-list-for-sale";

/** Sell this design in your own store. The quote total is the floor; the margin above it is split with us. */
export function ListForSale({ designId, quote }: { designId: string; quote: QuoteView | null }) {
  const form = useListForSale(designId, quote?.id ?? null, quote?.totalCents ?? null);
  if (!quote) return <p className="text-muted">Get quotes first, then pick one to set your floor price.</p>;
  return (
    <div className="space-y-1 border-t border-line pt-2">
      <p className="font-medium">List for sale in your store</p>
      <p className="text-muted">Floor price {formatCents(quote.totalCents)} (the chosen quote). Your price must be at or above it.</p>
      <input aria-label="Listing title" placeholder="Title" value={form.title} onChange={(e) => form.setTitle(e.target.value)} className="block w-full rounded border border-line-strong bg-transparent px-1 py-0.5" />
      <input aria-label="Your price in dollars" placeholder="Your price ($)" inputMode="decimal" value={form.price} onChange={(e) => form.setPrice(e.target.value)} className="block w-full rounded border border-line-strong bg-transparent px-1 py-0.5" />
      {form.split && (
        <p className="text-muted">
          You earn {formatCents(form.split.royaltyCents)} per sale; we keep {formatCents(form.split.platformFeeCents)}. Placeholder split until the fee is set.
        </p>
      )}
      <button type="button" onClick={() => void form.submit()} disabled={form.busy || form.done} className="rounded bg-primary px-2 py-0.5 text-on-primary disabled:opacity-40">
        List for sale
      </button>
      {form.message && <p role="status">{form.message}</p>}
    </div>
  );
}
