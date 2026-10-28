import { describe, expect, it } from "vitest";
import { matches, orderSummary, orderText, statusLabel, type OrderRow } from "./dashboard";

const order: OrderRow = {
  id: "abc-123",
  designId: "d",
  version: 2,
  status: "in_production",
  totalCents: 4510,
  quoteSnapshot: { materialName: "PETG (FDM)", partnerName: "Partner B", quantity: 3 },
  trackingNumber: null,
  createdAt: new Date(),
};

describe("dashboard helpers", () => {
  it("labels every status in plain words and passes unknown ones through", () => {
    expect(statusLabel("in_production")).toBe("Being made");
    expect(statusLabel("weird")).toBe("weird");
  });

  it("searches by every word, ignoring case", () => {
    expect(matches("Square Vase", "vase square")).toBe(true);
    expect(matches("Square Vase", "vase round")).toBe(false);
    expect(matches("anything", undefined)).toBe(true);
    expect(matches("anything", "  ")).toBe(true);
  });

  it("finds an order by material or status label", () => {
    expect(matches(orderText(order), "petg")).toBe(true);
    expect(matches(orderText(order), "being made")).toBe(true);
    expect(matches(orderText(order), "nylon")).toBe(false);
  });

  it("summarises an order", () => {
    expect(orderSummary(order)).toBe("3 x PETG (FDM), $45.10");
  });
});
