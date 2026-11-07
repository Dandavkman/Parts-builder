import { describe, expect, it } from "vitest";
import { acceptanceRecord, MINIMUM_AGE_YEARS, TERMS_VERSION, UNDER_AGE_MESSAGE } from "./age-gate";

describe("age gate", () => {
  it("makes no record until the box is ticked", () => {
    expect(acceptanceRecord(false)).toBeNull();
  });

  it("records age, version and time when ticked", () => {
    const record = acceptanceRecord(true, new Date("2026-11-07T12:00:00Z"));
    expect(record).toEqual({ over18: true, termsVersion: TERMS_VERSION, termsAcceptedAt: "2026-11-07T12:00:00.000Z" });
  });

  it("names the minimum age in the refusal", () => {
    expect(UNDER_AGE_MESSAGE).toContain(String(MINIMUM_AGE_YEARS));
  });
});
