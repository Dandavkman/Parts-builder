import { describe, expect, it } from "vitest";
import { geometryAuthHeaders, geometryServiceUrl } from "./geometry";

describe("geometryServiceUrl", () => {
  it("defaults to localhost and trims slashes", () => {
    expect(geometryServiceUrl({})).toBe("http://localhost:8000");
    expect(geometryServiceUrl({ GEOMETRY_SERVICE_URL: "https://x.fly.dev//" })).toBe("https://x.fly.dev");
  });
});

describe("geometryAuthHeaders", () => {
  it("sends the token as a bearer header", () => {
    expect(geometryAuthHeaders({ GEOMETRY_SERVICE_TOKEN: "abc" })).toEqual({ Authorization: "Bearer abc" });
  });
  it("sends nothing when no token is set", () => {
    expect(geometryAuthHeaders({})).toEqual({});
    expect(geometryAuthHeaders({ GEOMETRY_SERVICE_TOKEN: "" })).toEqual({});
  });
});
