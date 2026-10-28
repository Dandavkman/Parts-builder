import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { runnerFor, type Db } from "./db/client";
import { migrate } from "./db/migrations";
import * as schema from "./db/schema";
import { clientKey, hit, pruneRateLimits, tooMany } from "./rate-limit";

const LIMIT = { name: "test", max: 3, windowSeconds: 60 };

describe("rate limits", () => {
  let db: Db;
  beforeAll(async () => {
    db = drizzle(new PGlite(), { schema }) as unknown as Db;
    await migrate(runnerFor(db));
  });

  it("allows up to the maximum, then refuses with a retry time", async () => {
    const now = new Date("2026-01-01T00:00:10Z");
    for (let i = 0; i < 3; i++) expect((await hit(db, LIMIT, "a", now)).ok).toBe(true);
    const fourth = await hit(db, LIMIT, "a", now);
    expect(fourth).toEqual({ ok: false, retryAfterSeconds: 50 });
    expect(tooMany(fourth as { ok: false; retryAfterSeconds: number }).status).toBe(429);
  });

  it("keeps callers and actions apart, and starts fresh in the next window", async () => {
    const now = new Date("2026-01-01T00:05:10Z");
    for (let i = 0; i < 4; i++) await hit(db, LIMIT, "b", now);
    expect((await hit(db, LIMIT, "c", now)).ok).toBe(true);
    expect((await hit(db, { ...LIMIT, name: "other" }, "b", now)).ok).toBe(true);
    expect((await hit(db, LIMIT, "b", new Date("2026-01-01T00:06:00Z"))).ok).toBe(true);
  });

  it("counts requests that arrive together", async () => {
    const now = new Date("2026-01-01T01:00:00Z");
    const results = await Promise.all(Array.from({ length: 6 }, () => hit(db, LIMIT, "d", now)));
    expect(results.filter((r) => r.ok)).toHaveLength(3);
  });

  it("prunes old windows only", async () => {
    await pruneRateLimits(db, new Date("2026-01-03T00:00:00Z"));
    expect((await db.select().from(schema.rateLimits)).length).toBe(0);
  });
});

describe("clientKey", () => {
  it("takes the first forwarded address", () => {
    expect(clientKey(new Request("http://x", { headers: { "x-forwarded-for": "1.2.3.4, 10.0.0.1" } }))).toBe("1.2.3.4");
    expect(clientKey(new Request("http://x"))).toBe("unknown");
  });
});
