import { describe, expect, it } from "vitest";
import { MATERIALS } from "../materials";
import { buildQuotes, formatCents, priceLine } from "./engine";
import { PAYMENT_FEE_FIXED_CENTS, PAYMENT_FEE_PERCENT, type PartnerRates } from "./rate-cards";

const partner: PartnerRates = {
  id: "p",
  name: "P",
  shipping_cents: 1000,
  materials: { pla: { per_cm3_cents: 10, setup_fee_cents: 500, min_part_cents: 300, lead_days: 4 } },
};
const pla = MATERIALS.find((m) => m.id === "pla")!;

describe("priceLine", () => {
  it("adds partner cost, setup, markup, shipping and fee, and the parts add up", () => {
    // 50 cm3 at 10c = 500c a part, x2 = 1000c; + 500c setup = 1500c partner cost; 40% markup = 600c.
    const q = priceLine(partner, pla, 50_000, 2, 40, true)!;
    expect(q.partnerPartsCents).toBe(1000);
    expect(q.partnerCostCents).toBe(1500);
    expect(q.markupCents).toBe(600);
    expect(q.shippingCents).toBe(1000);
    expect(q.totalCents).toBe(q.partnerCostCents + q.markupCents + q.shippingCents + q.paymentFeeCents);
    // The fee is the stated share of the total plus the fixed part, to within a cent of rounding.
    expect(Math.abs(q.paymentFeeCents - (q.totalCents * PAYMENT_FEE_PERCENT) / 100 - PAYMENT_FEE_FIXED_CENTS)).toBeLessThanOrEqual(1);
    expect(q.placeholder).toBe(true);
  });

  it("charges the per-part minimum for a tiny part", () => {
    expect(priceLine(partner, pla, 100, 1, 0, true)!.partnerPartsCents).toBe(300);
  });

  it("returns null when the partner does not offer the material", () => {
    expect(priceLine(partner, MATERIALS.find((m) => m.id === "petg")!, 1000, 1, 0, true)).toBeNull();
  });
});

describe("buildQuotes", () => {
  const spec = { features: [{ type: "plate", id: "a", thickness_mm: 3 }] };

  it("quotes every partner and material that works, cheapest first", () => {
    const { quotes } = buildQuotes({ volume_mm3: 20_000, size_mm: [50, 40, 10], spec, quantity: 1 });
    expect(quotes.length).toBeGreaterThan(2);
    const totals = quotes.map((q) => q.totalCents);
    expect(totals).toEqual([...totals].sort((a, b) => a - b));
    expect(new Set(quotes.map((q) => q.partnerId)).size).toBeGreaterThan(1);
  });

  it("leaves out a material the part fails, with the reason", () => {
    const thin = { features: [{ type: "plate", id: "a", thickness_mm: 1 }] };
    const { quotes, unquoted } = buildQuotes({ volume_mm3: 5000, size_mm: [50, 40, 1], spec: thin, quantity: 1 });
    expect(quotes.map((q) => q.materialId)).toEqual(["nylon_sls"].filter((id) => quotes.some((q) => q.materialId === id)));
    expect(unquoted.find((u) => u.materialId === "pla")!.reasons[0]).toMatch(/minimum/);
  });

  it("leaves out a material when the part is bigger than the machine", () => {
    const { quotes, unquoted } = buildQuotes({ volume_mm3: 1e6, size_mm: [300, 300, 300], spec, quantity: 1 });
    expect(quotes.every((q) => q.materialId === "nylon_sls")).toBe(true);
    expect(unquoted.find((u) => u.materialId === "pla")!.reasons[0]).toMatch(/build size/);
  });

  it("rejects bad quantities and empty volumes", () => {
    expect(() => buildQuotes({ volume_mm3: 1000, size_mm: [1, 1, 1], spec, quantity: 0 })).toThrow();
    expect(() => buildQuotes({ volume_mm3: 1000, size_mm: [1, 1, 1], spec, quantity: 1.5 })).toThrow();
    expect(() => buildQuotes({ volume_mm3: 0, size_mm: [1, 1, 1], spec, quantity: 1 })).toThrow();
  });

  it("formats cents", () => {
    expect(formatCents(1234)).toBe("$12.34");
  });
});
