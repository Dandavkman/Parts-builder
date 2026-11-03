import { splitRetail, type Split } from "./royalty";
import type { ActionResult } from "./actions";

/** What the seller types and what we can show before sending. Pure; no React. */
export function listingDraft(
  floorCents: number,
  priceText: string,
  title: string,
): { ok: true; retailCents: number; title: string; split: Split } | { ok: false; reason: string } {
  const name = title.trim();
  if (!name) return { ok: false, reason: "Give the listing a title." };
  const dollars = Number(priceText.replace(/^\$/, ""));
  if (!priceText.trim() || !Number.isFinite(dollars)) return { ok: false, reason: "Enter a price in dollars." };
  const retailCents = Math.round(dollars * 100);
  const split = splitRetail(floorCents, retailCents);
  if ("error" in split) return { ok: false, reason: split.error };
  return { ok: true, retailCents, title: name, split };
}

/** Finds the seller's store id from `GET /api/stores`, then lists the design. Each step fails with one plain sentence. */
export async function listForSale(
  input: { designId: string; quoteId: string; retailCents: number; title: string },
  doFetch: typeof fetch = fetch,
): Promise<ActionResult<{ listingId: string }>> {
  try {
    const mine = await doFetch("/api/stores");
    const found = (await mine.json().catch(() => ({}))) as { store?: { id: string } | null; error?: string };
    if (!mine.ok) return { ok: false, error: found.error ?? "We could not load your store." };
    if (!found.store) return { ok: false, error: "Open your store first (Dashboard, then Your store)." };
    const response = await doFetch(`/api/stores/${found.store.id}/listings`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
    const data = (await response.json().catch(() => ({}))) as { listing?: { id: string }; error?: string };
    if (!response.ok || !data.listing) return { ok: false, error: data.error ?? "That did not work. Please try again." };
    return { ok: true, data: { listingId: data.listing.id } };
  } catch {
    return { ok: false, error: "We could not reach the server. Check your connection and try again." };
  }
}
