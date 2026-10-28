import { MATERIALS } from "../materials";
import { MARKUP_PERCENT, PLACEHOLDER_PARTNERS, RATES_ARE_PLACEHOLDER, type MaterialRate, type PartnerRates } from "./rate-cards";

/** What the quote engine prices from: partners and their rates, our markup, and whether the numbers are still stand-ins. */
export interface RatesConfig {
  partners: PartnerRates[];
  markupPercent: number;
  placeholder: boolean;
}

/** Used until an admin saves real rates. */
export const DEFAULT_RATES: RatesConfig = { partners: PLACEHOLDER_PARTNERS, markupPercent: MARKUP_PERCENT, placeholder: RATES_ARE_PLACEHOLDER };

const MATERIAL_IDS = new Set(MATERIALS.map((m) => m.id));
const int = (v: unknown, min: number, max: number): v is number => typeof v === "number" && Number.isInteger(v) && v >= min && v <= max;

/** Checks rates sent by an admin. Returns the clean config or every problem found, in plain words. */
export function parseRates(input: unknown): { ok: true; config: RatesConfig } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  const o = (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;
  if (typeof o.markupPercent !== "number" || !(o.markupPercent >= 0 && o.markupPercent <= 500)) errors.push("markupPercent must be a number from 0 to 500.");
  if (typeof o.placeholder !== "boolean") errors.push("placeholder must be true or false (false means these are real, confirmed rates).");
  const partners: PartnerRates[] = [];
  if (!Array.isArray(o.partners) || o.partners.length === 0 || o.partners.length > 20) errors.push("partners must be a list of 1 to 20 partners.");
  else {
    const seen = new Set<string>();
    o.partners.forEach((raw, i) => {
      const p = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
      const label = `partner ${i + 1}`;
      if (typeof p.id !== "string" || !/^[a-z0-9_-]{2,40}$/.test(p.id)) errors.push(`${label}: id must be 2 to 40 lowercase letters, digits, - or _.`);
      else if (seen.has(p.id)) errors.push(`${label}: id ${p.id} is used twice.`);
      else seen.add(p.id);
      if (typeof p.name !== "string" || !p.name.trim() || p.name.length > 80) errors.push(`${label}: name is required (up to 80 characters).`);
      if (!int(p.shipping_cents, 0, 100_000)) errors.push(`${label}: shipping_cents must be a whole number of cents from 0 to 100000.`);
      const materials: Record<string, MaterialRate> = {};
      const m = (typeof p.materials === "object" && p.materials !== null ? p.materials : {}) as Record<string, unknown>;
      for (const [id, rawRate] of Object.entries(m)) {
        const r = (typeof rawRate === "object" && rawRate !== null ? rawRate : {}) as Record<string, unknown>;
        if (!MATERIAL_IDS.has(id)) errors.push(`${label}: unknown material ${id}.`);
        else if (!int(r.per_cm3_cents, 0, 10_000) || !int(r.setup_fee_cents, 0, 1_000_000) || !int(r.min_part_cents, 0, 1_000_000) || !int(r.lead_days, 0, 365)) {
          errors.push(`${label}, ${id}: per_cm3_cents, setup_fee_cents, min_part_cents and lead_days must be whole numbers in range.`);
        } else materials[id] = { per_cm3_cents: r.per_cm3_cents, setup_fee_cents: r.setup_fee_cents, min_part_cents: r.min_part_cents, lead_days: r.lead_days };
      }
      if (Object.keys(m).length === 0) errors.push(`${label}: offer at least one material.`);
      if (typeof p.id === "string" && typeof p.name === "string" && int(p.shipping_cents, 0, 100_000)) partners.push({ id: p.id, name: p.name.trim(), shipping_cents: p.shipping_cents, materials });
    });
  }
  return errors.length ? { ok: false, errors } : { ok: true, config: { partners, markupPercent: o.markupPercent as number, placeholder: o.placeholder as boolean } };
}
