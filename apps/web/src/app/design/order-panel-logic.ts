import { formatCents } from "../../lib/quotes/engine";

export interface QuoteView {
  id: string;
  partnerName: string;
  materialName: string;
  quantity: number;
  totalCents: number;
  leadDays: number;
  placeholder: boolean;
}

export interface AddressForm {
  name: string;
  line1: string;
  line2: string;
  city: string;
  region: string;
  postal_code: string;
  country: string;
  email: string;
}

export const EMPTY_ADDRESS: AddressForm = { name: "", line1: "", line2: "", city: "", region: "", postal_code: "", country: "US", email: "" };

/** One line for the quote list: "Nylon PA12 (SLS) from Partner B: $24.10 for 2, about 7 days". */
export function describeQuote(q: QuoteView): string {
  return `${q.materialName} from ${q.partnerName}: ${formatCents(q.totalCents)} for ${q.quantity}, about ${q.leadDays} days`;
}

/** The order request, or why it cannot be sent yet. */
export function orderRequest(
  quoteId: string | null,
  address: AddressForm,
  confirmNotSafetyCritical: boolean,
  acceptFitTerms: boolean,
): { ok: true; body: Record<string, unknown> } | { ok: false; reason: string } {
  if (!quoteId) return { ok: false, reason: "Choose a quote first." };
  const missing = (["name", "line1", "city", "region", "postal_code", "country"] as const).filter((k) => !address[k].trim());
  if (missing.length) return { ok: false, reason: "Fill in the shipping address." };
  if (!confirmNotSafetyCritical || !acceptFitTerms) return { ok: false, reason: "Tick both boxes to order." };
  const { email, ...shipping } = address;
  return { ok: true, body: { quoteId, shipping, email: email.trim(), confirmNotSafetyCritical, acceptFitTerms } };
}
