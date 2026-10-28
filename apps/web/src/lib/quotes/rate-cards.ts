/**
 * PLACEHOLDER rate cards, markup and fees (task B2.5a).
 *
 * Every number in this file is a stand-in so the quote engine, the quote screen and checkout can be
 * built and tested before the Owner has real partner data (O1.5, O2.1) and has decided pricing (O2.3).
 * They are NOT real prices. Quotes made from them are marked `placeholder` and the screens say so.
 * Replace this file's contents (or load the same shapes from the admin-editable tables in B2.7) before
 * any paid order, then set RATES_ARE_PLACEHOLDER to false.
 */
export const RATES_ARE_PLACEHOLDER = true;

/** Our markup on the partner's price, in percent. PLACEHOLDER until the Owner decides (O2.3). */
export const MARKUP_PERCENT = 40;
/** Card processing: percent of the total plus a fixed amount. PLACEHOLDER; Stripe's published US card rate is a typical start. */
export const PAYMENT_FEE_PERCENT = 2.9;
export const PAYMENT_FEE_FIXED_CENTS = 30;
/** Quotes stop being valid after this many days (plan B2.5). */
export const QUOTE_VALID_DAYS = 14;

/** What one partner charges to make one material. All money is in US cents. */
export interface MaterialRate {
  /** Price for each cubic centimeter of part. */
  per_cm3_cents: number;
  /** One-time cost per order, however many parts. */
  setup_fee_cents: number;
  /** The partner will not charge less than this per part. */
  min_part_cents: number;
  lead_days: number;
}

export interface PartnerRates {
  id: string;
  name: string;
  /** Shipping to the customer, flat per order. PLACEHOLDER. */
  shipping_cents: number;
  materials: Record<string, MaterialRate>;
}

export const PLACEHOLDER_PARTNERS: PartnerRates[] = [
  {
    id: "partner_a",
    name: "Example Partner A (placeholder)",
    shipping_cents: 800,
    materials: {
      pla: { per_cm3_cents: 8, setup_fee_cents: 300, min_part_cents: 400, lead_days: 5 },
      petg: { per_cm3_cents: 10, setup_fee_cents: 300, min_part_cents: 500, lead_days: 5 },
      tpu: { per_cm3_cents: 16, setup_fee_cents: 400, min_part_cents: 700, lead_days: 6 },
    },
  },
  {
    id: "partner_b",
    name: "Example Partner B (placeholder)",
    shipping_cents: 1200,
    materials: {
      petg: { per_cm3_cents: 9, setup_fee_cents: 500, min_part_cents: 600, lead_days: 8 },
      nylon_sls: { per_cm3_cents: 22, setup_fee_cents: 1500, min_part_cents: 1500, lead_days: 7 },
    },
  },
];
