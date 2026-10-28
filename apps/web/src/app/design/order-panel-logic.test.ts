import { describe, expect, it } from "vitest";
import { describeQuote, EMPTY_ADDRESS, orderRequest } from "./order-panel-logic";

const address = { ...EMPTY_ADDRESS, name: "Ada", line1: "1 Main St", city: "Denver", region: "CO", postal_code: "80202" };

describe("order panel logic", () => {
  it("describes a quote in one line", () => {
    expect(describeQuote({ id: "q", partnerName: "B", materialName: "PETG", quantity: 2, totalCents: 2410, leadDays: 7, placeholder: true })).toBe(
      "PETG from B: $24.10 for 2, about 7 days",
    );
  });

  it("will not build a request until a quote, the address and both boxes are done", () => {
    expect(orderRequest(null, address, true, true)).toMatchObject({ ok: false, reason: "Choose a quote first." });
    expect(orderRequest("q", EMPTY_ADDRESS, true, true)).toMatchObject({ ok: false, reason: "Fill in the shipping address." });
    expect(orderRequest("q", address, true, false)).toMatchObject({ ok: false, reason: "Tick both boxes to order." });
    expect(orderRequest("q", address, false, true)).toMatchObject({ ok: false });
  });

  it("builds the request the orders route expects", () => {
    expect(orderRequest("q", address, true, true)).toEqual({
      ok: true,
      body: { quoteId: "q", shipping: { name: "Ada", line1: "1 Main St", line2: "", city: "Denver", region: "CO", postal_code: "80202", country: "US" }, email: "", confirmNotSafetyCritical: true, acceptFitTerms: true },
    });
  });
});
