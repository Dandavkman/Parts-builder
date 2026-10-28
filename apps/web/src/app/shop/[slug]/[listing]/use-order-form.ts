"use client";

import { useState } from "react";
import { emptyOrderForm, submitListingOrder, type OrderForm } from "../../../../lib/orders/order-form";

/** State and actions for the order form. No markup: any layout can use it. */
export function useOrderForm(listingId: string) {
  const [form, setForm] = useState<OrderForm>(emptyOrderForm);
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [placed, setPlaced] = useState<string | null>(null);
  const [needsSignIn, setNeedsSignIn] = useState(false);

  const set = <K extends keyof OrderForm>(key: K, value: OrderForm[K]) => setForm((f) => ({ ...f, [key]: value }));

  async function submit() {
    setBusy(true);
    setErrors([]);
    setNeedsSignIn(false);
    const outcome = await submitListingOrder(listingId, form);
    setBusy(false);
    if (outcome.kind === "redirect") window.location.assign(outcome.url);
    else if (outcome.kind === "placed") setPlaced(outcome.orderId);
    else if (outcome.kind === "sign_in") setNeedsSignIn(true);
    else setErrors(outcome.errors);
  }

  return { form, set, errors, busy, placed, needsSignIn, submit };
}
export type OrderFormState = ReturnType<typeof useOrderForm>;
