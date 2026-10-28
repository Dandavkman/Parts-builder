/**
 * Seller pricing (task B4.3a). PLACEHOLDER numbers until the Owner decides the platform fee and royalty
 * rule (O4.2). Money is integer US cents.
 *
 * floor   = our price for the part (the quote total: partner cost, markup, shipping and payment fee).
 * margin  = retail price above the floor.
 * We keep PLATFORM_FEE_PERCENT of the margin; the seller keeps the rest as their royalty.
 * A retail price below the floor is refused.
 */
export const PLATFORM_FEE_PERCENT = 20;
export const STORE_FEES_ARE_PLACEHOLDER = true;

export interface Split {
  floorCents: number;
  retailCents: number;
  platformFeeCents: number;
  royaltyCents: number;
}

export function splitRetail(floorCents: number, retailCents: number, platformFeePercent = PLATFORM_FEE_PERCENT): Split | { error: string } {
  if (!Number.isInteger(retailCents) || retailCents <= 0) return { error: "The price must be a whole number of cents above zero." };
  if (retailCents < floorCents) return { error: `The price cannot be below the floor of $${(floorCents / 100).toFixed(2)} (our price for making and shipping it).` };
  const margin = retailCents - floorCents;
  const platformFeeCents = Math.round((margin * platformFeePercent) / 100);
  return { floorCents, retailCents, platformFeeCents, royaltyCents: margin - platformFeeCents };
}

/** A store address: lowercase letters, digits and single hyphens, 3 to 30 characters, no edge hyphens. */
export function validSlug(slug: unknown): slug is string {
  return typeof slug === "string" && /^[a-z0-9](?:[a-z0-9]|-(?=[a-z0-9])){1,28}[a-z0-9]$/.test(slug);
}

const RESERVED = new Set(["www", "app", "api", "admin", "store", "stores", "shop", "help", "support", "mail"]);
export const isReserved = (slug: string) => RESERVED.has(slug);
