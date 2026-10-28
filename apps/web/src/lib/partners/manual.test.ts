import { describe, expect, it } from "vitest";
import type { Order } from "../orders/store";
import { jobSheet, manualPartner } from "./manual";

const order = {
  id: "ord-1",
  designId: "des-1",
  version: 3,
  specSnapshot: { name: "Knob" },
  quoteSnapshot: { materialName: "PETG (FDM)", partnerName: "Partner B", quantity: 2, leadDays: 8 },
  shippingAddress: { name: "Ada", line1: "1 Main St", line2: "Apt 2", city: "Denver", region: "CO", postal_code: "80202", country: "US" },
  safetyConfirmedAt: new Date("2026-10-28T12:00:00Z"),
} as unknown as Order;

describe("job sheet and manual partner", () => {
  it("lists the part, material, quantity, destination and the safety confirmation", () => {
    const text = jobSheet(order);
    for (const part of ["ord-1", "Knob", "version 3", "PETG (FDM)", "Quantity: 2", "Ada", "1 Main St, Apt 2", "Denver, CO 80202  US", "2026-10-28T12:00:00.000Z"]) {
      expect(text).toContain(part);
    }
  });

  it("a manual partner returns instructions and no reference yet", async () => {
    const partner = manualPartner("b", "Partner B", ["petg"]);
    const placed = await partner.placeOrder(order);
    expect(partner.adapter).toBe("manual");
    expect(placed.partnerOrderRef).toBeNull();
    expect(placed.instructions).toContain("Partner B");
    expect(placed.instructions).toContain("JOB SHEET");
  });
});
