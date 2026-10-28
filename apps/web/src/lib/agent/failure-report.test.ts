import { describe, expect, it } from "vitest";
import { benchmarkCandidates, compareRates, failureReason, firstRequest, normalizeReason, outcomeOf, successRate, topFailures, type LoggedDesign } from "./failure-report";

/** A synthetic log, shaped like the saved conversations and versions, standing in until real Phase 2 logs exist. */
const design = (id: string, ask: string, versions: { ok: boolean; errors?: string[] }[]): LoggedDesign => ({
  id,
  history: [{ role: "user", content: ask }, { role: "assistant", content: [{ type: "text", text: "On it." }] }],
  versions: versions.map((v, i) => ({ version: i + 1, buildOk: v.ok, buildErrors: v.errors ?? [] })),
});

const LOG: LoggedDesign[] = [
  design("a", "a phone stand", [{ ok: true }]),
  design("b", "a gauge pod for my dash", [{ ok: false, errors: ["Hole 3 at 12.5 mm is outside the plate"] }]),
  design("c", "a dash vent bracket", [{ ok: false, errors: ["Hole 7 at 40 mm is outside the plate"] }]),
  design("d", "a cup holder insert", [{ ok: false, errors: ["Hole 2 at 9 mm is outside the plate"] }, { ok: true }]),
  design("e", "something cool", []),
  design("f", "a spice rack", []),
  design("g", "a bike mount", [{ ok: false, errors: ["shell wall is thicker than the body"] }]),
];

describe("failure report", () => {
  it("reads the first request from a string or a block list", () => {
    expect(firstRequest(LOG[0].history)).toBe("a phone stand");
    expect(firstRequest([{ role: "user", content: [{ type: "image" }, { type: "text", text: "  a knob " }] }])).toBe("a knob");
    expect(firstRequest([])).toBe("");
  });

  it("classifies outcomes by the latest version", () => {
    expect(LOG.map(outcomeOf)).toEqual(["built", "last_failed", "last_failed", "built", "never_built", "never_built", "last_failed"]);
  });

  it("clusters errors that differ only in numbers", () => {
    expect(normalizeReason("Hole 3 at 12.5 mm is outside the plate")).toBe(normalizeReason("Hole 7 at 40 mm is outside the plate"));
    expect(failureReason(LOG[0])).toBeNull();
    expect(failureReason(LOG[4])).toBe("no spec was produced");
  });

  it("ranks the most common failures with example requests", () => {
    const top = topFailures(LOG);
    expect(top[0]).toMatchObject({ reason: "hole # at # mm is outside the plate", count: 2 });
    expect(top[0].examples).toEqual(["a gauge pod for my dash", "a dash vent bracket"]);
    expect(top[1]).toMatchObject({ reason: "no spec was produced", count: 2 });
    expect(topFailures(LOG, 1)).toHaveLength(1);
  });

  it("scores the success rate and compares two runs", () => {
    expect(successRate(LOG)).toBeCloseTo(2 / 7);
    expect(successRate([])).toBe(0);
    expect(compareRates(LOG, [LOG[0], LOG[3]])).toBe("Built on the last try: 28.6% of 7 before, 100.0% of 2 after (+71.4 points).");
  });

  it("drafts benchmark cases from failed requests, without repeats and with sizes left empty", () => {
    const cases = benchmarkCandidates(topFailures(LOG), 3);
    expect(cases.map((c) => c.prompt)).toEqual(["a gauge pod for my dash", "a dash vent bracket", "something cool"]);
    expect(cases.every((c) => c.dimensions.length === 0)).toBe(true);
    expect(cases.map((c) => c.id)).toEqual(["failed-1", "failed-2", "failed-3"]);
  });
});
