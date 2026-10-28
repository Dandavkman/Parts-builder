export interface ShippingAddress {
  name: string;
  line1: string;
  line2?: string;
  city: string;
  region: string;
  postal_code: string;
  /** Two-letter country code. */
  country: string;
}

const text = (v: unknown, max: number): string | null =>
  typeof v === "string" && v.trim().length > 0 && v.trim().length <= max ? v.trim() : null;

/** Checks a shipping address from the browser. Returns the cleaned address, or the problems in plain words. */
export function parseAddress(input: unknown): { ok: true; address: ShippingAddress } | { ok: false; errors: string[] } {
  const o = (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;
  const errors: string[] = [];
  const need = (key: string, label: string, max = 100) => {
    const v = text(o[key], max);
    if (!v) errors.push(`${label} is required (up to ${max} characters).`);
    return v ?? "";
  };
  const name = need("name", "Name");
  const line1 = need("line1", "Address line 1");
  const city = need("city", "City");
  const region = need("region", "State or region");
  const postal_code = need("postal_code", "Postal code", 20);
  const country = need("country", "Country", 2).toUpperCase();
  if (country && !/^[A-Z]{2}$/.test(country)) errors.push("Country must be a two-letter code such as US.");
  const line2 = o.line2 === undefined || o.line2 === "" ? undefined : (text(o.line2, 100) ?? undefined);
  if (o.line2 !== undefined && o.line2 !== "" && !line2) errors.push("Address line 2 is too long.");
  if (errors.length) return { ok: false, errors };
  return { ok: true, address: { name, line1, ...(line2 ? { line2 } : {}), city, region, postal_code, country } };
}
