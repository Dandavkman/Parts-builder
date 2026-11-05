import { describe, expect, it } from "vitest";
import { describePack, findPacks, lookupReference, REFERENCE_PACKS, REFERENCE_RULE, unverifiedFor } from "./reference-packs";

describe("reference packs", () => {
  it("never carry a value on an unverified fact, and every fact names a source", () => {
    for (const p of REFERENCE_PACKS) {
      for (const f of p.facts) {
        expect(f.source.length).toBeGreaterThan(5);
        if (f.confidence === "unverified") expect(f.value).toBeUndefined();
        if (f.unit === "text") expect(f.text).toBeTruthy();
        else expect(f.value).not.toBeUndefined();
      }
    }
  });
  it("keep fact and needed keys unique inside a pack, and never list a fact as both known and needed", () => {
    for (const p of REFERENCE_PACKS) {
      const keys = [...p.facts.map((f) => f.key), ...p.needed.map((n) => n.key)];
      expect(new Set(keys).size).toBe(keys.length);
    }
  });
  it("find the packs the test prompt needs", () => {
    expect(findPacks("exhaust manifold for a 1995 miata with a bp05 engine")[0].id).toBe("mazda-bp-exhaust-port");
    expect(findPacks("size it for a maxpeedingrods gt2871")[0].id).toBe("maxpeedingrods-gt2871");
    expect(findPacks("check the engine bay clearance")[0].id).toBe("miata-engine-bay");
    expect(findPacks("pepperoni")).toEqual([]);
    expect(findPacks("")).toEqual([]);
  });
});

describe("lookupReference", () => {
  it("reports published values with their source and confidence", () => {
    const text = lookupReference("gt2871 turbo");
    expect(text).toContain("Turbine A/R: 0.64 [published");
    expect(text).toContain("Turbine wheel inducer diameter: 53.8 mm [published");
  });
  it("lists what is not available instead of guessing, and states the fit rule", () => {
    const text = lookupReference("miata bp head exhaust port stud");
    expect(text).toContain("NOT AVAILABLE");
    expect(text).toContain("Stud positions on the exhaust face");
    expect(text).not.toMatch(/stud.*\d+(\.\d+)? mm \[/i);
    expect(text).toContain(REFERENCE_RULE);
  });
  it("does not invent a port size when sources disagree", () => {
    const text = lookupReference("bp exhaust port");
    expect(text).toContain("unresolved");
    expect(text).toContain("[unverified");
  });
  it("has no clearance numbers for the engine bay and says so", () => {
    const pack = REFERENCE_PACKS.find((p) => p.id === "miata-engine-bay")!;
    expect(pack.facts).toEqual([]);
    expect(describePack(pack)).toContain("Firewall position");
  });
  it("answers an unknown topic and a bad input plainly", () => {
    expect(lookupReference("pepperoni")).toContain("No reference data");
    expect(lookupReference(42)).toContain("topic must be text");
  });
});

describe("unverifiedFor", () => {
  it("lists every unpublished or missing fact for the packs", () => {
    const gaps = unverifiedFor(["maxpeedingrods-gt2871"]);
    expect(gaps).toContain("maxpeedingrods-gt2871:housing_drawing");
    expect(gaps).toContain("maxpeedingrods-gt2871:housing_material");
    expect(gaps).not.toContain("maxpeedingrods-gt2871:turbine_ar");
  });
  it("drops what the user has supplied", () => {
    const gaps = unverifiedFor(["maxpeedingrods-gt2871"], ["housing_drawing", "housing_material"]);
    expect(gaps).not.toContain("maxpeedingrods-gt2871:housing_drawing");
    expect(gaps).not.toContain("maxpeedingrods-gt2871:housing_material");
  });
});
