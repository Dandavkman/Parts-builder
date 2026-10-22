import { describe, expect, it } from "vitest";
import { getAuthMode } from "./auth-mode";

const keys = { NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_test_x", CLERK_SECRET_KEY: "sk_test_x" };

describe("getAuthMode", () => {
  it("uses clerk when both keys are set", () => {
    expect(getAuthMode({ ...keys, NODE_ENV: "production" })).toBe("clerk");
  });

  it("fails closed when keys are missing", () => {
    expect(getAuthMode({ NODE_ENV: "production" })).toBe("unconfigured");
    expect(getAuthMode({ NODE_ENV: "development" })).toBe("unconfigured");
  });

  it("fails closed when only one key is set", () => {
    expect(getAuthMode({ CLERK_SECRET_KEY: "sk_test_x" })).toBe("unconfigured");
    expect(getAuthMode({ NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_test_x" })).toBe("unconfigured");
  });

  it("allows the dev bypass only in development with the explicit flag", () => {
    expect(getAuthMode({ NODE_ENV: "development", ALLOW_UNAUTHENTICATED_DEV: "true" })).toBe(
      "dev-bypass",
    );
    expect(getAuthMode({ NODE_ENV: "production", ALLOW_UNAUTHENTICATED_DEV: "true" })).toBe(
      "unconfigured",
    );
    expect(getAuthMode({ NODE_ENV: "development", ALLOW_UNAUTHENTICATED_DEV: "1" })).toBe(
      "unconfigured",
    );
    expect(getAuthMode({ NODE_ENV: "test", ALLOW_UNAUTHENTICATED_DEV: "true" })).toBe(
      "unconfigured",
    );
  });

  it("prefers clerk over the bypass when keys exist", () => {
    expect(
      getAuthMode({ ...keys, NODE_ENV: "development", ALLOW_UNAUTHENTICATED_DEV: "true" }),
    ).toBe("clerk");
  });
});
