import { describe, expect, it } from "vitest";
import { fitWithin, MAX_PHOTO_SIDE_PX } from "./photo";

describe("fitWithin", () => {
  it("shrinks the longest side to the limit and keeps the proportions", () => {
    expect(fitWithin(4000, 3000, MAX_PHOTO_SIDE_PX)).toEqual({ width: 1600, height: 1200 });
    expect(fitWithin(3000, 6000, 1600)).toEqual({ width: 800, height: 1600 });
  });

  it("never enlarges a small photo", () => {
    expect(fitWithin(800, 600, 1600)).toEqual({ width: 800, height: 600 });
  });

  it("never returns a zero size", () => {
    expect(fitWithin(10000, 1, 1600)).toEqual({ width: 1600, height: 1 });
  });
});
