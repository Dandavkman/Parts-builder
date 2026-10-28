import { describe, expect, it } from "vitest";
import { isAdmin } from "./admin";

describe("isAdmin", () => {
  it("is false for everyone when no list is set", () => {
    expect(isAdmin("user_1", {})).toBe(false);
  });

  it("matches ids in a comma separated list, ignoring spaces", () => {
    const env = { ADMIN_USER_IDS: "user_1, user_2" };
    expect(isAdmin("user_2", env)).toBe(true);
    expect(isAdmin("user_3", env)).toBe(false);
  });

  it("treats the dev user as admin only in the dev bypass", () => {
    expect(isAdmin("dev", { NODE_ENV: "development", ALLOW_UNAUTHENTICATED_DEV: "true" })).toBe(true);
    expect(isAdmin("dev", { NODE_ENV: "production", ALLOW_UNAUTHENTICATED_DEV: "true" })).toBe(false);
    expect(isAdmin("dev", { ADMIN_USER_IDS: "dev" })).toBe(false);
  });
});
