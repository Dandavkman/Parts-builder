import { describe, expect, it } from "vitest";
import { canMove, isOrderStatus, ORDER_STATUSES } from "./status";

describe("order status flow", () => {
  it("follows the plan's main path", () => {
    const path = ["quote", "paid", "sent_to_partner", "in_production", "shipped", "delivered"] as const;
    for (let i = 0; i < path.length - 1; i++) expect(canMove(path[i], path[i + 1])).toBe(true);
  });

  it("holds a reviewed order in in_review before it goes to the partner", () => {
    expect(canMove("paid", "in_review")).toBe(true);
    expect(canMove("in_review", "sent_to_partner")).toBe(true);
    expect(canMove("in_review", "in_production")).toBe(false);
  });

  it("cannot skip ahead, go back, or leave a finished state", () => {
    expect(canMove("quote", "shipped")).toBe(false);
    expect(canMove("shipped", "paid")).toBe(false);
    for (const to of ORDER_STATUSES) {
      expect(canMove("cancelled", to)).toBe(false);
      expect(canMove("refunded", to)).toBe(false);
    }
  });

  it("recognises statuses", () => {
    expect(isOrderStatus("paid")).toBe(true);
    expect(isOrderStatus("shiped")).toBe(false);
  });
});
