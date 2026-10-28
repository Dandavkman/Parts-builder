import { describe, expect, it, vi } from "vitest";
import { buildEvent, parseDsn, reportError } from "./observability";

const DSN = "https://abc123@o1.ingest.sentry.io/42";

describe("parseDsn", () => {
  it("builds the store URL and auth header", () => {
    const t = parseDsn(DSN);
    expect(t?.url).toBe("https://o1.ingest.sentry.io/api/42/store/");
    expect(t?.authHeader).toContain("sentry_key=abc123");
  });
  it("is null when unset or malformed", () => {
    expect(parseDsn(undefined)).toBeNull();
    expect(parseDsn("")).toBeNull();
    expect(parseDsn("not a url")).toBeNull();
    expect(parseDsn("https://o1.ingest.sentry.io/42")).toBeNull();
  });
});

describe("buildEvent", () => {
  it("carries the error and short context, and trims long text", () => {
    const e = new Error("x".repeat(5000));
    const event = buildEvent("order failed", e, { route: "orders" });
    expect(event.tags).toEqual({ route: "orders" });
    expect(event.exception.values[0].value).toHaveLength(2000);
    expect(buildEvent("m", "boom").exception.values[0].value).toBe("boom");
    expect(buildEvent("m", { secret: 1 }).exception.values[0].value).toBe("non-error thrown");
  });
});

describe("reportError", () => {
  it("only logs when no DSN is set", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const send = vi.fn();
    await reportError("failed", new Error("a"), {}, {}, send as unknown as typeof fetch);
    expect(log).toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
    log.mockRestore();
  });
  it("sends to Sentry when a DSN is set, and survives a failing tracker", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const send = vi.fn().mockResolvedValue(new Response("ok"));
    await reportError("failed", new Error("a"), {}, { SENTRY_DSN: DSN }, send as unknown as typeof fetch);
    expect(send).toHaveBeenCalledOnce();
    expect(send.mock.calls[0][0]).toBe("https://o1.ingest.sentry.io/api/42/store/");
    const down = vi.fn().mockRejectedValue(new Error("network"));
    await expect(reportError("failed", new Error("a"), {}, { SENTRY_DSN: DSN }, down as unknown as typeof fetch)).resolves.toBeUndefined();
    log.mockRestore();
  });
});
