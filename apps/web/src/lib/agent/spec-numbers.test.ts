import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { collectNumbers, onlyNumbersChanged, setAtPath } from "./spec-numbers";

const spec = JSON.parse(
  readFileSync(new URL("../../../../../services/geometry/src/geometry/spec/examples/v1/hole.json", import.meta.url), "utf8"),
) as Record<string, unknown>;

describe("collectNumbers", () => {
  it("finds every _mm and _deg value, with readable labels and the right units", () => {
    const numbers = collectNumbers(spec);
    const labels = numbers.map((n) => n.label);
    expect(labels.some((l) => l.includes("thickness_mm"))).toBe(true);
    expect(labels.some((l) => l.includes("diameter_mm"))).toBe(true);
    expect(labels.some((l) => l.includes("position_mm x"))).toBe(true);
    expect(numbers.every((n) => ["mm", "deg"].includes(n.unit))).toBe(true);
    expect(numbers.every((n) => n.min <= n.value && n.value <= n.max)).toBe(true);
  });

  it("ignores counts, text and versions", () => {
    const found = collectNumbers({
      spec_version: "1.1",
      name: "x",
      features: [{ id: "p", type: "hole_pattern", pattern: { count_x: 3, spacing_x_mm: 10 } }],
    });
    expect(found.map((n) => n.label)).toEqual(["p pattern spacing_x_mm"]);
  });

  it("lets positions go negative and angles span a full turn", () => {
    const found = collectNumbers({ features: [{ id: "s", position_mm: [5, 0], angle_deg: 30 }] });
    const pos = found.find((n) => n.label === "s position_mm x")!;
    const angle = found.find((n) => n.label === "s angle_deg")!;
    expect(pos.min).toBeLessThan(0);
    expect(angle.min).toBe(-360);
  });
});

describe("setAtPath", () => {
  it("changes one number and leaves the original alone", () => {
    const target = collectNumbers(spec)[0];
    const changed = setAtPath(spec, target.path, target.value + 1);
    expect(collectNumbers(changed)[0].value).toBe(target.value + 1);
    expect(collectNumbers(spec)[0].value).toBe(target.value);
  });
});

describe("onlyNumbersChanged", () => {
  it("accepts number edits", () => {
    const target = collectNumbers(spec)[0];
    expect(onlyNumbersChanged(spec, setAtPath(spec, target.path, target.value * 2))).toBe(true);
  });

  it("rejects added, removed or retyped fields and changed text", () => {
    expect(onlyNumbersChanged(spec, { ...spec, extra: 1 })).toBe(false);
    expect(onlyNumbersChanged(spec, { ...spec, name: "other" })).toBe(false);
    expect(onlyNumbersChanged(spec, { ...spec, features: [] })).toBe(false);
    expect(onlyNumbersChanged({ a: 1 }, { a: "1" })).toBe(false);
    expect(onlyNumbersChanged({ a: 1 }, { a: Number.NaN })).toBe(false);
    expect(onlyNumbersChanged({ a: [1, 2] }, { a: [1] })).toBe(false);
    expect(onlyNumbersChanged({ a: 1 }, null)).toBe(false);
  });
});
