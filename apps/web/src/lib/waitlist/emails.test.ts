import { describe, expect, it } from "vitest";
import { normalizeEmail, waitlistCsv } from "./emails";

describe("normalizeEmail", () => {
  it("trims and lower-cases", () => expect(normalizeEmail("  Ann@Example.COM ")).toBe("ann@example.com"));
  it("rejects bad input", () => {
    for (const bad of ["", "nope", "a@b", "a b@c.com", 5, null, `${"x".repeat(200)}@a.com`]) expect(normalizeEmail(bad)).toBeNull();
  });
});

describe("waitlistCsv", () => {
  it("writes a header and one line per row", () => {
    const csv = waitlistCsv([{ email: "a@b.co", createdAt: new Date("2026-11-01T00:00:00Z") }]);
    expect(csv).toBe("email,joined_at\na@b.co,2026-11-01T00:00:00.000Z\n");
  });
  it("defuses formulas and quotes commas", () => {
    const csv = waitlistCsv([
      { email: "=cmd@x.co", createdAt: new Date(0) },
      { email: "a,b@x.co", createdAt: new Date(0) },
    ]);
    expect(csv).toContain("'=cmd@x.co,");
    expect(csv).toContain('"a,b@x.co",');
  });
});
