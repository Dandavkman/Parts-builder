import { describe, expect, it } from "vitest";
import { frameCamera, gridFor } from "./frame";

describe("frameCamera", () => {
  it("looks at a big part from further away, with a clipping range that contains it", () => {
    const small = frameCamera([50, 50, 50], [0, 25, 0], 40, 1.5);
    const wing = frameCamera([1300, 225, 305], [0, 112, 0], 40, 1.5);
    const dist = (f: ReturnType<typeof frameCamera>, c: number[]) => Math.hypot(f.position[0] - c[0], f.position[1] - c[1], f.position[2] - c[2]);
    expect(dist(wing, [0, 112, 0])).toBeGreaterThan(dist(small, [0, 25, 0]) * 10);
    expect(wing.far).toBeGreaterThan(dist(wing, [0, 112, 0]) + 700);
    expect(wing.near).toBeLessThan(dist(wing, [0, 112, 0]) - 700);
  });
  it("backs off further in a narrow view", () => {
    const wide = frameCamera([100, 100, 100], [0, 0, 0], 40, 2);
    const tall = frameCamera([100, 100, 100], [0, 0, 0], 40, 0.5);
    expect(Math.hypot(...tall.position)).toBeGreaterThan(Math.hypot(...wide.position));
  });
});

describe("gridFor", () => {
  it("grows the cells with the part", () => {
    expect(gridFor(60).cell_mm).toBe(2);
    expect(gridFor(1300).cell_mm).toBe(50);
    expect(gridFor(1300).section_mm).toBe(250);
  });
});
