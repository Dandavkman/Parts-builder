import { describe, expect, it } from "vitest";
import { isNearBottom } from "./stick";

describe("isNearBottom", () => {
  it("follows new content when the reader is at the bottom", () => {
    expect(isNearBottom(1000, 600, 400)).toBe(true);
    expect(isNearBottom(1000, 540, 400)).toBe(true);
  });
  it("leaves the reader alone after they scroll up", () => {
    expect(isNearBottom(1000, 200, 400)).toBe(false);
  });
});
