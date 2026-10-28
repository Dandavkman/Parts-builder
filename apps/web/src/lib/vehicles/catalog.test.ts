import { describe, expect, it } from "vitest";
import { getVehicle, searchVehicles, SCAN_AREAS, VEHICLES } from "./catalog";

const ids = (q: string) => searchVehicles(q).map((v) => v.id);

describe("vehicle search", () => {
  it("finds a car by make, model, generation or year", () => {
    expect(ids("mazda")).toEqual(["mazda-mx5-na", "mazda-mx5-nb"]);
    expect(ids("civic")).toEqual(["honda-civic-ek"]);
    expect(ids("ZC6")).toEqual(["subaru-brz-zc6"]);
    expect(ids("1994")).toEqual(["mazda-mx5-na"]);
    expect(ids("2003")).toEqual(["mazda-mx5-nb"]);
  });

  it("matches partial and punctuated words, in any order", () => {
    expect(ids("mia")).toEqual(["mazda-mx5-na", "mazda-mx5-nb"]);
    expect(ids("mx5")).toEqual(["mazda-mx5-na", "mazda-mx5-nb"]);
    expect(ids("mx-5 na")).toEqual(["mazda-mx5-na"]);
    expect(ids("na miata 1990")).toEqual(["mazda-mx5-na"]);
  });

  it("combines words with and, and returns all for an empty query", () => {
    expect(ids("mazda civic")).toEqual([]);
    expect(ids("  ")).toHaveLength(VEHICLES.length);
  });
});

describe("catalog data", () => {
  it("has unique ids, sane year ranges and known scan areas", () => {
    expect(new Set(VEHICLES.map((v) => v.id)).size).toBe(VEHICLES.length);
    for (const v of VEHICLES) {
      expect(v.yearFrom).toBeLessThanOrEqual(v.yearTo);
      for (const a of v.scanned) expect(SCAN_AREAS).toContain(a);
    }
    expect(getVehicle("mazda-mx5-na")?.scanned).toContain("dash");
    expect(getVehicle("nope")).toBeUndefined();
  });
});
