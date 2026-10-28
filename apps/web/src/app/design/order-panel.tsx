"use client";

import { useState } from "react";
import { formatCents } from "../../lib/quotes/engine";
import { describeQuote, EMPTY_ADDRESS, orderRequest, type AddressForm, type QuoteView } from "./order-panel-logic";

interface Unquoted {
  materialName: string;
  reasons: string[];
}

const FIELDS: { key: keyof AddressForm; label: string }[] = [
  { key: "name", label: "Full name" },
  { key: "line1", label: "Address line 1" },
  { key: "line2", label: "Address line 2 (optional)" },
  { key: "city", label: "City" },
  { key: "region", label: "State or region" },
  { key: "postal_code", label: "Postal code" },
  { key: "country", label: "Country (2 letters)" },
  { key: "email", label: "Email for order updates" },
];

/** Get quotes for the current version, pick one, and order it. Prices come from the server; the panel says when they are placeholders. */
export function OrderPanel({ designId, version }: { designId: string; version: number | null }) {
  const [quantity, setQuantity] = useState(1);
  const [quotes, setQuotes] = useState<QuoteView[]>([]);
  const [unquoted, setUnquoted] = useState<Unquoted[]>([]);
  const [placeholder, setPlaceholder] = useState(false);
  const [chosen, setChosen] = useState<string | null>(null);
  const [address, setAddress] = useState<AddressForm>(EMPTY_ADDRESS);
  const [safe, setSafe] = useState(false);
  const [terms, setTerms] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function getQuotes() {
    setBusy(true);
    setMessage(null);
    const response = await fetch(`/api/designs/${designId}/quotes`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ quantity }),
    }).catch(() => null);
    const data = (await response?.json().catch(() => null)) as
      | { quotes?: QuoteView[]; unquoted?: Unquoted[]; placeholder?: boolean; error?: string }
      | null;
    setBusy(false);
    if (!response?.ok || !data?.quotes) {
      setMessage(data?.error ?? "Could not get quotes.");
      return;
    }
    setQuotes(data.quotes);
    setUnquoted(data.unquoted ?? []);
    setPlaceholder(data.placeholder === true);
    setChosen(data.quotes[0]?.id ?? null);
  }

  async function order() {
    const request = orderRequest(chosen, address, safe, terms);
    if (!request.ok) {
      setMessage(request.reason);
      return;
    }
    setBusy(true);
    const response = await fetch(`/api/designs/${designId}/orders`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(request.body),
    }).catch(() => null);
    const data = (await response?.json().catch(() => null)) as
      | { order?: { status: string; totalCents: number }; checkoutUrl?: string; error?: string; errors?: string[] }
      | null;
    setBusy(false);
    if (data?.checkoutUrl) {
      window.location.assign(data.checkoutUrl);
      return;
    }
    if (!response?.ok || !data?.order) {
      setMessage([data?.error, ...(data?.errors ?? [])].filter(Boolean).join(" ") || "Could not place the order.");
      return;
    }
    setQuotes([]);
    setMessage(`Order placed (${data.order.status.replace("_", " ")}, ${formatCents(data.order.totalCents)}). See it on your dashboard.`);
  }

  if (version === null) return null;
  return (
    <details className="mt-2 text-xs">
      <summary className="cursor-pointer text-zinc-500">Quote and order</summary>
      <div className="mt-1 space-y-2">
        <div className="flex items-center gap-2">
          <label htmlFor="order-quantity">Quantity</label>
          <input
            id="order-quantity"
            type="number"
            min={1}
            max={100}
            value={quantity}
            onChange={(e) => setQuantity(Math.max(1, Math.floor(Number(e.target.value)) || 1))}
            className="w-16 rounded border border-zinc-300 bg-transparent px-1 dark:border-zinc-700"
          />
          <button type="button" onClick={() => void getQuotes()} disabled={busy} className="rounded border border-zinc-300 px-2 py-0.5 disabled:opacity-40 dark:border-zinc-700">
            Get quotes
          </button>
        </div>
        {placeholder && quotes.length > 0 && (
          <p className="rounded bg-amber-100 px-2 py-1 text-amber-900">Example prices only: real partner rates are not set up yet.</p>
        )}
        {quotes.length > 0 && (
          <ul aria-label="Quotes" className="space-y-1">
            {quotes.map((q) => (
              <li key={q.id}>
                <label className="flex items-center gap-2">
                  <input type="radio" name="quote" checked={chosen === q.id} onChange={() => setChosen(q.id)} />
                  {describeQuote(q)}
                </label>
              </li>
            ))}
          </ul>
        )}
        {unquoted.length > 0 && (
          <ul className="space-y-0.5 text-zinc-500">
            {unquoted.map((u) => (
              <li key={u.materialName}>
                {u.materialName}: {u.reasons.join("; ")}
              </li>
            ))}
          </ul>
        )}
        {quotes.length > 0 && (
          <div className="space-y-1">
            {FIELDS.map((f) => (
              <input
                key={f.key}
                aria-label={f.label}
                placeholder={f.label}
                value={address[f.key]}
                onChange={(e) => setAddress((a) => ({ ...a, [f.key]: e.target.value }))}
                className="block w-full rounded border border-zinc-300 bg-transparent px-1 py-0.5 dark:border-zinc-700"
              />
            ))}
            <label className="flex items-start gap-2">
              <input type="checkbox" checked={safe} onChange={(e) => setSafe(e.target.checked)} />I confirm this part is not safety-critical (not for brakes, steering, seat belts or similar).
            </label>
            <label className="flex items-start gap-2">
              <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} />I accept the fit and use terms.
            </label>
            <button type="button" onClick={() => void order()} disabled={busy} className="rounded bg-zinc-900 px-3 py-1 text-white disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900">
              Place order
            </button>
          </div>
        )}
        {message && <p role="status">{message}</p>}
      </div>
    </details>
  );
}
