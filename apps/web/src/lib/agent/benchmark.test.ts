import { describe, expect, it } from "vitest";
import { EVERYDAY_CASES, passed, reportTable, scoreRun } from "./benchmark";
import type { AgentEvent } from "./types";

const usage = { input_tokens: 100, output_tokens: 50, cache_creation_input_tokens: 10, cache_read_input_tokens: 5 };
const spec = (ok: boolean, checks?: string[]): AgentEvent => ({ type: "spec", attempt: 1, ok, errors: [], spec: {}, ...(checks ? { checks } : {}) });

describe("EVERYDAY_CASES", () => {
  it("has the five storyboard cases with measurable dimensions", () => {
    expect(EVERYDAY_CASES.map((c) => c.id)).toEqual(["vase", "box", "holder", "knob", "bracket"]);
    for (const c of EVERYDAY_CASES) {
      expect(c.dimensions.length).toBeGreaterThan(0);
      expect(c.dimensions.every((d) => d.measures && d.confidence === "stated")).toBe(true);
      // Every stated size appears in the prompt, so the agent is not asked to guess it.
      for (const d of c.dimensions) expect(c.prompt).toContain(String(d.value_mm));
    }
  });
});

describe("scoreRun", () => {
  it("passes a run whose last build matched every size", () => {
    const row = scoreRun("vase", [spec(false), spec(true)], usage, 2);
    expect(row).toEqual({ id: "vase", validSpec: true, dimensionNotes: [], attempts: 2, tokens: 165 });
    expect(passed(row)).toBe(true);
  });
  it("fails a run that built but missed a size, and ignores wall notes", () => {
    const row = scoreRun("box", [spec(true, ["Dimension check: 'box_height' should be 50 mm but the part is 45.0 mm", "Wall check: thin"])], usage, 1);
    expect(row.dimensionNotes).toHaveLength(1);
    expect(passed(row)).toBe(false);
  });
  it("fails a run that never built", () => {
    const row = scoreRun("knob", [spec(false), spec(false)], usage, 6);
    expect(row.validSpec).toBe(false);
    expect(passed(row)).toBe(false);
  });
  it("scores on the last spec that built, not an earlier miss", () => {
    const row = scoreRun("vase", [spec(true, ["Dimension check: miss"]), spec(true)], usage, 2);
    expect(passed(row)).toBe(true);
  });
});

describe("reportTable", () => {
  it("writes one row per case with the totals", () => {
    const rows = [scoreRun("vase", [spec(true)], usage, 1), scoreRun("box", [spec(false)], usage, 6)];
    const text = reportTable(rows, { model: "m", date: "2026-10-26" });
    expect(text).toContain("Passed: 1 of 2.");
    expect(text).toContain("| vase | yes | all match | 1 | 165 |");
    expect(text).toContain("| box | no | n/a | 6 | 165 |");
  });
});
