import { describe, expect, it } from "vitest";
import { parseAddress } from "./address";

const good = { name: " Ada ", line1: "1 Main St", city: "Denver", region: "CO", postal_code: "80202", country: "us" };

describe("parseAddress", () => {
  it("cleans a good address", () => {
    expect(parseAddress(good)).toEqual({
      ok: true,
      address: { name: "Ada", line1: "1 Main St", city: "Denver", region: "CO", postal_code: "80202", country: "US" },
    });
  });

  it("lists every missing or bad field", () => {
    const r = parseAddress({ ...good, name: "", city: 5, country: "USA" });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.join(" ")).toMatch(/Name is required/);
      expect(r.errors.join(" ")).toMatch(/City is required/);
      expect(r.errors.join(" ")).toMatch(/Country/);
    }
  });

  it("rejects non-objects", () => {
    expect(parseAddress(null).ok).toBe(false);
    expect(parseAddress("home").ok).toBe(false);
  });
});
