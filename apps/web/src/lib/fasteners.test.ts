import { describe, expect, it } from "vitest";
import { FASTENERS, lookupFastener } from "./fasteners";

describe("lookupFastener", () => {
  it("gives the tap drills the prompt promises", () => {
    expect(lookupFastener("M10x1.25", "tap")).toContain("8.8 mm");
    expect(lookupFastener("M8", "tap")).toContain("6.8 mm");
    expect(lookupFastener("m6", "tap")).toContain("5 mm");
  });
  it("covers clearance, insert and counterbore", () => {
    expect(lookupFastener("M5", "clearance")).toContain("5.5 mm");
    expect(lookupFastener("M3", "insert")).toContain("4.2 mm");
    expect(lookupFastener("M6", "counterbore")).toContain("10 mm counterbore");
  });
  it("explains bad input", () => {
    expect(lookupFastener("M7", "tap")).toContain("Unknown size");
    expect(lookupFastener("M6", "weld")).toContain("kind must be");
    expect(lookupFastener(6, "tap")).toContain("size must be");
    expect(lookupFastener("M6x0.75", "tap")).toContain("No data");
  });
  it("keeps every row sane", () => {
    for (const f of FASTENERS) {
      expect(f.tap_drill_mm).toBeLessThan(f.major_mm);
      expect(f.clearance_mm).toBeGreaterThan(f.major_mm);
      expect(f.insert_hole_mm).toBeGreaterThan(f.major_mm);
      expect(f.cbore_diameter_mm).toBeGreaterThan(f.clearance_mm);
    }
  });
});
