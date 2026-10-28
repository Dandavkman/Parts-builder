import { describe, expect, it } from "vitest";
import { getPaymentProvider } from "./provider";

describe("getPaymentProvider", () => {
  it("allows the stub in development", () => {
    expect(getPaymentProvider({ NODE_ENV: "development" })?.name).toBe("stub");
  });

  it("has no provider in production unless the stub is switched on deliberately", () => {
    expect(getPaymentProvider({ NODE_ENV: "production" })).toBeNull();
    expect(getPaymentProvider({ NODE_ENV: "production", PAYMENTS_STUB: "1" })?.name).toBe("stub");
  });
});
