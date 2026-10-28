"use client";

import Link from "next/link";
import type { OrderForm } from "../../../../lib/orders/order-form";
import { useOrderForm } from "./use-order-form";

const FIELDS: { key: Exclude<keyof OrderForm, "confirmNotSafetyCritical" | "acceptFitTerms">; label: string; autoComplete: string; required?: boolean }[] = [
  { key: "name", label: "Full name", autoComplete: "name", required: true },
  { key: "line1", label: "Address line 1", autoComplete: "address-line1", required: true },
  { key: "line2", label: "Address line 2", autoComplete: "address-line2" },
  { key: "city", label: "City", autoComplete: "address-level2", required: true },
  { key: "region", label: "State or region", autoComplete: "address-level1", required: true },
  { key: "postal_code", label: "Postal code", autoComplete: "postal-code", required: true },
  { key: "country", label: "Country (two letters)", autoComplete: "country", required: true },
  { key: "email", label: "Email for order updates", autoComplete: "email" },
];

/** The order form for one listing: shipping address, the two confirmations, and the buy button. Markup only; the logic is in use-order-form. */
export function OrderFormView({ listingId }: { listingId: string }) {
  const { form, set, errors, busy, placed, needsSignIn, submit } = useOrderForm(listingId);
  if (placed) {
    return (
      <p className="mt-6 rounded border border-line p-4" role="status">
        Thank you. Your order is placed (reference {placed}). We will email you as it moves along.
      </p>
    );
  }
  return (
    <form
      className="mt-6 space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      {FIELDS.map((f) => (
        <label key={f.key} className="block text-sm">
          <span className="text-muted">{f.label}</span>
          <input
            className="mt-1 w-full rounded border border-line-strong bg-page px-3 py-2"
            value={form[f.key]}
            autoComplete={f.autoComplete}
            required={f.required}
            maxLength={f.key === "country" ? 2 : 100}
            onChange={(e) => set(f.key, e.target.value)}
          />
        </label>
      ))}
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" checked={form.confirmNotSafetyCritical} onChange={(e) => set("confirmNotSafetyCritical", e.target.checked)} className="mt-1" />
        <span>This part is not safety-critical (not for brakes, steering, restraints, medical or climbing use).</span>
      </label>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" checked={form.acceptFitTerms} onChange={(e) => set("acceptFitTerms", e.target.checked)} className="mt-1" />
        <span>
          I accept the{" "}
          <Link href="/terms" className="underline">
            fit terms
          </Link>
          .
        </span>
      </label>
      {errors.length > 0 && (
        <ul className="rounded border border-danger-line px-3 py-2 text-sm text-danger" role="alert">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}
      {needsSignIn && (
        <p className="text-sm" role="alert">
          Please{" "}
          <Link href="/sign-in" className="underline">
            sign in
          </Link>{" "}
          to place your order, then come back to this page.
        </p>
      )}
      <button type="submit" disabled={busy} className="rounded bg-primary px-4 py-2 text-on-primary disabled:opacity-60">
        {busy ? "Placing order..." : "Place order"}
      </button>
    </form>
  );
}
