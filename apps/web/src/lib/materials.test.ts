import { describe, expect, it } from "vitest";
import { assessMaterials, describeAdvice, MATERIALS, partFacts, recommend } from "./materials";

const vase = (wall: number) => ({
  features: [{ id: "v", type: "body", shell: { wall_thickness_mm: wall, open: "top" } }],
});

describe("partFacts", () => {
  it("reads the thinnest wall and smallest hole", () => {
    const spec = {
      features: [
        { id: "p", type: "plate", thickness_mm: 4 },
        { id: "b", type: "body", shell: { wall_thickness_mm: 2 } },
        { id: "h", type: "hole", diameter_mm: 6.5 },
        { id: "s", type: "standoff", hole_diameter_mm: 3 },
      ],
    };
    expect(partFacts(spec)).toEqual({ thinnest_wall_mm: 2, smallest_hole_mm: 3 });
  });
  it("says null when the part has none", () => {
    expect(partFacts({ features: [] })).toEqual({ thinnest_wall_mm: null, smallest_hole_mm: null });
  });
});

describe("assessMaterials", () => {
  it("passes a 2 mm wall everywhere", () => {
    expect(assessMaterials(vase(2), [100, 100, 200]).every((a) => a.problems.length === 0)).toBe(true);
  });
  it("fails FDM but passes SLS for a 1 mm wall", () => {
    const byId = Object.fromEntries(assessMaterials(vase(1)).map((a) => [a.material.id, a.problems.length]));
    expect(byId).toMatchObject({ pla: 1, petg: 1, tpu: 1, nylon_sls: 0 });
  });
  it("fails a hole smaller than the minimum", () => {
    const spec = { features: [{ id: "h", type: "hole", diameter_mm: 1.8 }] };
    const pla = assessMaterials(spec).find((a) => a.material.id === "pla")!;
    expect(pla.problems[0]).toContain("1.8 mm hole");
  });
  it("fails a part that is too big, in any orientation", () => {
    const tall = assessMaterials({ features: [] }, [100, 100, 300]);
    expect(tall.find((a) => a.material.id === "pla")!.problems[0]).toContain("build size");
    expect(tall.find((a) => a.material.id === "nylon_sls")!.problems).toEqual([]);
    const long = assessMaterials({ features: [] }, [300, 20, 20]);
    expect(long.find((a) => a.material.id === "nylon_sls")!.problems).toEqual([]);
  });
});

describe("recommend", () => {
  const all = assessMaterials(vase(2), [100, 100, 200]);
  it("lists passing materials cheapest first", () => {
    expect(recommend(all).recommended.map((m) => m.id)).toEqual(["petg", "pla", "tpu", "nylon_sls", "al6061_cnc"].sort((a, b) => order(a) - order(b)));
  });
  it("filters by heat, outdoor use, flexibility and load", () => {
    expect(recommend(all, { heat_c: 90 }).recommended.map((m) => m.id)).toEqual(["nylon_sls", "al6061_cnc"]);
    expect(recommend(all, { outdoor: true }).recommended.map((m) => m.id)).not.toContain("pla");
    expect(recommend(all, { flexible: true }).recommended.map((m) => m.id)).toEqual(["tpu"]);
    expect(recommend(all, { load: true }).recommended.map((m) => m.id)).toEqual(["nylon_sls", "al6061_cnc"]);
  });
  it("keeps failing materials out of the recommendation", () => {
    const advice = recommend(assessMaterials(vase(1)));
    expect(advice.recommended.map((m) => m.id)).toEqual(["nylon_sls"]);
    expect(advice.rejected).toHaveLength(MATERIALS.length - 1);
  });
});

describe("describeAdvice", () => {
  it("names suitable materials and the reasons for the others", () => {
    const text = describeAdvice(recommend(assessMaterials(vase(1))));
    expect(text).toContain("Nylon PA12 (SLS)");
    expect(text).toContain("PLA (FDM): walls of 1 mm are under its 1.2 mm minimum.");
  });
  it("says so when nothing passes", () => {
    expect(describeAdvice(recommend(assessMaterials(vase(0.3))))).toContain("No material");
  });
});

// Cheapest first, then stronger first, as recommend() sorts.
function order(id: string): number {
  const m = MATERIALS.find((x) => x.id === id)!;
  return m.cost * 10 - m.strength;
}

describe("CNC aluminum", () => {
  const bracket = {
    features: [
      { id: "p", type: "plate", thickness_mm: 5, outline: { kind: "rectangle", width_mm: 80, length_mm: 40 } },
      { id: "h", type: "hole", plate: "p", diameter_mm: 6.5, position_mm: [0, 0] },
      { id: "s", type: "slot", plate: "p" },
    ],
  };
  const cnc = (spec: Record<string, unknown>, size: [number, number, number] = [80, 40, 5]) => assessMaterials(spec, size).find((a) => a.material.id === "al6061_cnc")!;

  it("passes a flat bracket with round holes and slots", () => {
    expect(cnc(bracket).problems).toEqual([]);
  });
  it("rejects a closed hollow body (undercut) but accepts one open at the top", () => {
    const body = (open: string) => ({ features: [{ id: "b", type: "body", shell: { wall_thickness_mm: 3, open } }] });
    expect(cnc(body("none"), [50, 50, 50]).problems.join(" ")).toContain("cavity");
    expect(cnc(body("top"), [50, 50, 50]).problems).toEqual([]);
  });
  it("rejects a rectangular cutout for its sharp inside corners", () => {
    const spec = { features: [...bracket.features, { id: "c", type: "cutout", plate: "p", zone: { kind: "rectangle", width_mm: 10, length_mm: 10 } }] };
    expect(cnc(spec).problems.join(" ")).toContain("sharp inside corners");
    const round = { features: [...bracket.features, { id: "c", type: "cutout", plate: "p", zone: { kind: "circle", diameter_mm: 10 } }] };
    expect(cnc(round).problems).toEqual([]);
  });
  it("only applies the milling rules to CNC", () => {
    const hollow = { features: [{ id: "b", type: "body", shell: { wall_thickness_mm: 3, open: "none" } }] };
    expect(assessMaterials(hollow, [50, 50, 50]).find((a) => a.material.id === "petg")!.problems).toEqual([]);
  });
});
