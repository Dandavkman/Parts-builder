import { describe, expect, it } from "vitest";
import { siteUrl } from "./site";

describe("siteUrl", () => {
  it("prefers SITE_URL without a trailing slash, then Vercel's production URL, then localhost", () => {
    expect(siteUrl({ SITE_URL: "https://example.com/", VERCEL_PROJECT_PRODUCTION_URL: "x.vercel.app" })).toBe("https://example.com");
    expect(siteUrl({ VERCEL_PROJECT_PRODUCTION_URL: "x.vercel.app" })).toBe("https://x.vercel.app");
    expect(siteUrl({})).toBe("http://localhost:3000");
  });

  it("gives a valid base address for page metadata, including for the live domain", () => {
    expect(new URL(siteUrl({ SITE_URL: "https://ktiso.app" })).origin).toBe("https://ktiso.app");
    expect(new URL(siteUrl({})).origin).toBe("http://localhost:3000");
  });
});
