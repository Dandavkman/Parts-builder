import { parseAddress, type ShippingAddress } from "./address";

/** What the buyer types into the order form. Plain strings and two checkboxes; no presentation. */
export interface OrderForm {
  name: string;
  line1: string;
  line2: string;
  city: string;
  region: string;
  postal_code: string;
  country: string;
  email: string;
  confirmNotSafetyCritical: boolean;
  acceptFitTerms: boolean;
}

export const emptyOrderForm: OrderForm = {
  name: "",
  line1: "",
  line2: "",
  city: "",
  region: "",
  postal_code: "",
  country: "US",
  email: "",
  confirmNotSafetyCritical: false,
  acceptFitTerms: false,
};

export type OrderPayload = { shipping: ShippingAddress; email?: string; confirmNotSafetyCritical: true; acceptFitTerms: true };

/** Checks the form before it is sent. Returns the request body or the problems in plain words. */
export function readOrderForm(form: OrderForm): { ok: true; payload: OrderPayload } | { ok: false; errors: string[] } {
  const address = parseAddress(form);
  const errors = address.ok ? [] : [...address.errors];
  if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) errors.push("That email address does not look right.");
  if (!form.confirmNotSafetyCritical) errors.push("Confirm the part is not safety-critical.");
  if (!form.acceptFitTerms) errors.push("Accept the fit terms to order.");
  if (!address.ok || errors.length) return { ok: false, errors };
  const email = form.email.trim();
  return { ok: true, payload: { shipping: address.address, ...(email ? { email } : {}), confirmNotSafetyCritical: true, acceptFitTerms: true } };
}

export type OrderOutcome =
  | { kind: "redirect"; url: string }
  | { kind: "placed"; orderId: string }
  | { kind: "sign_in" }
  | { kind: "error"; errors: string[] };

/** Sends the order for a listing and says what to do next: go to payment, show the confirmation, sign in, or fix something. */
export async function submitListingOrder(listingId: string, form: OrderForm, doFetch: typeof fetch = fetch): Promise<OrderOutcome> {
  const read = readOrderForm(form);
  if (!read.ok) return { kind: "error", errors: read.errors };
  let response: Response;
  try {
    response = await doFetch(`/api/listings/${encodeURIComponent(listingId)}/order`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(read.payload),
    });
  } catch {
    return { kind: "error", errors: ["We could not reach the server. Check your connection and try again."] };
  }
  const body = (await response.json().catch(() => ({}))) as { error?: string; errors?: string[]; checkoutUrl?: string; order?: { id?: string } };
  if (response.status === 401) return { kind: "sign_in" };
  if (!response.ok) return { kind: "error", errors: body.errors?.length ? body.errors : [body.error ?? "The order could not be placed."] };
  if (body.checkoutUrl) return { kind: "redirect", url: body.checkoutUrl };
  if (body.order?.id) return { kind: "placed", orderId: body.order.id };
  return { kind: "error", errors: ["The order could not be placed."] };
}
