import { describe, expect, it } from "vitest";
import { checkBuild, thinWalls, toleranceMm } from "./checks";
import type { AgentDimension } from "./types";

const height: AgentDimension = {
  id: "vase_height",
  value_mm: 200,
  source: "user",
  confidence: "stated",
  measures: "overall_height",
};

describe("dimension check", () => {
  it("is quiet when the built size matches within tolerance", () => {
    expect(checkBuild({}, [80, 80, 200], [height])).toEqual([]);
    expect(checkBuild({}, [80, 80, 200.9], [height])).toEqual([]);
  });

  it("flags a part built 1 mm or more too tall or too short", () => {
    const [tall] = checkBuild({}, [80, 80, 201.5], [height]);
    expect(tall).toContain("should be 200 mm but the part is 201.5 mm, 1.5 mm too large");
    const [short] = checkBuild({}, [80, 80, 190], [height]);
    expect(short).toContain("10.0 mm too small");
  });

  it("uses 0.5% for large parts", () => {
    expect(toleranceMm(100)).toBe(1);
    expect(toleranceMm(1000)).toBe(5);
  });

  it("maps width, length and diameter to the right axes and skips dimensions that measure nothing", () => {
    const dims: AgentDimension[] = [
      { id: "w", value_mm: 60, source: "user", confidence: "stated", measures: "overall_width" },
      { id: "l", value_mm: 40, source: "user", confidence: "stated", measures: "overall_length" },
      { id: "d", value_mm: 90, source: "user", confidence: "stated", measures: "overall_diameter" },
      { id: "other", value_mm: 5, source: "user", confidence: "stated" },
    ];
    expect(checkBuild({}, [60, 40, 10], dims)).toEqual([expect.stringContaining("'d'")]);
    expect(checkBuild({}, [90, 90, 10], dims.slice(2))).toEqual([]);
  });

  it("does nothing when the service reported no size", () => {
    expect(checkBuild({}, undefined, [height])).toEqual([]);
  });
});

describe("wall check", () => {
  it("flags thin shell walls and thin plates", () => {
    const spec = {
      features: [
        { id: "vase", type: "body", shell: { wall_thickness_mm: 0.8, open: "top" } },
        { id: "base", type: "plate", thickness_mm: 1 },
        { id: "ok", type: "plate", thickness_mm: 3 },
      ],
    };
    const notes = thinWalls(spec);
    expect(notes).toHaveLength(2);
    expect(notes[0]).toContain("'vase' has walls of 0.8 mm");
    expect(notes[1]).toContain("plate 'base' is 1 mm");
  });

  it("is quiet for a normal part and for a spec with no features", () => {
    expect(thinWalls({ features: [{ id: "a", type: "plate", thickness_mm: 2 }] })).toEqual([]);
    expect(thinWalls({})).toEqual([]);
  });
});
