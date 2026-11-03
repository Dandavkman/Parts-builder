"use client";

import { useState } from "react";
import { listForSale, listingDraft } from "../../lib/stores/list-for-sale";

/** State for the "list for sale" form. `floorCents` is the chosen quote's total. */
export function useListForSale(designId: string, quoteId: string | null, floorCents: number | null) {
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const draft = floorCents === null ? null : listingDraft(floorCents, price, title);
  const split = draft?.ok ? draft.split : null;

  async function submit() {
    if (!quoteId || !draft) return setMessage("Choose a quote first.");
    if (!draft.ok) return setMessage(draft.reason);
    setBusy(true);
    setMessage(null);
    const result = await listForSale({ designId, quoteId, retailCents: draft.retailCents, title: draft.title });
    setBusy(false);
    if (!result.ok) return setMessage(result.error);
    setDone(true);
    setMessage("Listed. It goes live after review.");
  }

  return { title, setTitle, price, setPrice, busy, message, done, split, submit };
}
