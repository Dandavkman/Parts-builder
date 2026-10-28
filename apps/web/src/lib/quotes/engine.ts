import { MATERIALS, assessMaterials, type Material } from "../materials";
import {
  MARKUP_PERCENT,
  PAYMENT_FEE_FIXED_CENTS,
  PAYMENT_FEE_PERCENT,
  PLACEHOLDER_PARTNERS,
  RATES_ARE_PLACEHOLDER,
  type PartnerRates,
} from "./rate-cards";

/** One quote: a partner making a material. Every component is stored so margin stays visible (plan rule 5). All money is US cents. */
export interface QuoteLine {
  partnerId: string;
  partnerName: string;
  materialId: string;
  materialName: string;
  quantity: number;
  /** Partner's price for the parts, after their per-part minimum. */
  partnerPartsCents: number;
  setupFeeCents: number;
  /** Partner cost = parts + setup fee. Shipping is separate because it is passed on at cost. */
  partnerCostCents: number;
  markupCents: number;
  shippingCents: number;
  paymentFeeCents: number;
  totalCents: number;
  leadDays: number;
  placeholder: boolean;
}

export interface QuoteInput {
  volume_mm3: number;
  size_mm: [number, number, number];
  spec: Record<string, unknown>;
  quantity: number;
  partners?: PartnerRates[];
  materials?: Material[];
  markupPercent?: number;
  placeholder?: boolean;
}

export interface Unquoted {
  materialId: string;
  materialName: string;
  reasons: string[];
}

export interface QuoteResult {
  quotes: QuoteLine[];
  /** Materials no quote was made for, with the printability reason or "no partner offers it". */
  unquoted: Unquoted[];
}

export const MAX_QUANTITY = 100;

const round = Math.round;

/** Price one part in one material at one partner. Pure; integer cents. */
export function priceLine(
  partner: PartnerRates,
  material: Material,
  volume_mm3: number,
  quantity: number,
  markupPercent: number,
  placeholder: boolean,
): QuoteLine | null {
  const rate = partner.materials[material.id];
  if (!rate) return null;
  const perPart = Math.max(rate.min_part_cents, round((volume_mm3 / 1000) * rate.per_cm3_cents));
  const partnerPartsCents = perPart * quantity;
  const partnerCostCents = partnerPartsCents + rate.setup_fee_cents;
  const markupCents = round((partnerCostCents * markupPercent) / 100);
  const subtotal = partnerCostCents + markupCents + partner.shipping_cents;
  // The fee is a share of what the customer pays, so solve total = subtotal + pct * total + fixed.
  const total = round((subtotal + PAYMENT_FEE_FIXED_CENTS) / (1 - PAYMENT_FEE_PERCENT / 100));
  return {
    partnerId: partner.id,
    partnerName: partner.name,
    materialId: material.id,
    materialName: material.name,
    quantity,
    partnerPartsCents,
    setupFeeCents: rate.setup_fee_cents,
    partnerCostCents,
    markupCents,
    shippingCents: partner.shipping_cents,
    paymentFeeCents: total - subtotal,
    totalCents: total,
    leadDays: rate.lead_days,
    placeholder,
  };
}

/**
 * One quote for every partner that can make every material the part passes the printability check for
 * (decision D2), cheapest first.
 */
export function buildQuotes(input: QuoteInput): QuoteResult {
  const partners = input.partners ?? PLACEHOLDER_PARTNERS;
  const materials = input.materials ?? MATERIALS;
  const placeholder = input.placeholder ?? RATES_ARE_PLACEHOLDER;
  const markup = input.markupPercent ?? MARKUP_PERCENT;
  if (!(input.volume_mm3 > 0)) throw new Error("volume_mm3 must be positive");
  if (!Number.isInteger(input.quantity) || input.quantity < 1 || input.quantity > MAX_QUANTITY) {
    throw new Error(`quantity must be a whole number from 1 to ${MAX_QUANTITY}`);
  }
  const assessments = assessMaterials(input.spec, input.size_mm);
  const quotes: QuoteLine[] = [];
  const unquoted: Unquoted[] = [];
  for (const { material, problems } of assessments) {
    if (!materials.includes(material)) continue;
    const lines = problems.length
      ? []
      : partners.flatMap((p) => priceLine(p, material, input.volume_mm3, input.quantity, markup, placeholder) ?? []);
    if (lines.length) quotes.push(...lines);
    else {
      unquoted.push({
        materialId: material.id,
        materialName: material.name,
        reasons: problems.length ? problems : ["no print partner offers this material yet"],
      });
    }
  }
  quotes.sort((a, b) => a.totalCents - b.totalCents);
  return { quotes, unquoted };
}

export function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}
