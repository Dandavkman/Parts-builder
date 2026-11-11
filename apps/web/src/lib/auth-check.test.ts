import { describe, expect, it } from "vitest";
import { checkClerkKeys } from "./auth-check";

describe("checkClerkKeys", () => {
  it("accepts a matching, clean pair", () => {
    const r = checkClerkKeys({ NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_live_abc123", CLERK_SECRET_KEY: "sk_live_def456" });
    expect(r.problems).toEqual([]);
    expect(r.secret).toEqual({ set: true, clean: true, kind: "live" });
  });
  it("flags a secret key with a trailing ellipsis or smart quote", () => {
    expect(checkClerkKeys({ NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_live_a", CLERK_SECRET_KEY: "sk_live_abc…" }).problems[0]).toMatch(/CLERK_SECRET_KEY has a space/);
    expect(checkClerkKeys({ NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_live_a", CLERK_SECRET_KEY: "“sk_live_abc”" }).secret.clean).toBe(false);
  });
  it("flags a live and test mix, and missing keys", () => {
    expect(checkClerkKeys({ NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_live_a", CLERK_SECRET_KEY: "sk_test_b" }).problems[0]).toMatch(/same Clerk instance/);
    expect(checkClerkKeys({}).problems).toHaveLength(2);
  });
  it("never returns the key itself", () => {
    expect(JSON.stringify(checkClerkKeys({ NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_live_SECRETBITS", CLERK_SECRET_KEY: "sk_live_SECRETBITS" }))).not.toContain("SECRETBITS");
  });
});
