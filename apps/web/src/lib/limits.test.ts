import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { createDesign } from "./agent/store";
import { runnerFor, type Db } from "./db/client";
import { migrate } from "./db/migrations";
import * as schema from "./db/schema";
import { checkAiMessage, checkNewDesign, LIMITS, periodOf, limitsEnforced } from "./limits";
import { aiMessagesUsed, countAiMessage, designCount } from "./limits-store";

describe("usage limits", () => {
  it("stops AI messages at the monthly limit, with no upgrade offer", () => {
    expect(checkAiMessage(LIMITS.aiMessagesPerMonth - 1)).toEqual({ ok: true });
    const r = checkAiMessage(LIMITS.aiMessagesPerMonth);
    expect(r.ok).toBe(false);
    expect(r).not.toHaveProperty("upgrade");
  });

  it("limits saved designs", () => {
    expect(checkNewDesign(LIMITS.savedDesigns - 1).ok).toBe(true);
    expect(checkNewDesign(LIMITS.savedDesigns).ok).toBe(false);
  });

  it("is off unless LIMITS_ENFORCED=1, and counts months in UTC", () => {
    expect(limitsEnforced({})).toBe(false);
    expect(limitsEnforced({ LIMITS_ENFORCED: "1" })).toBe(true);
    expect(periodOf(new Date("2026-10-31T23:59:59Z"))).toBe("2026-10");
    expect(periodOf(new Date("2026-11-01T00:00:00Z"))).toBe("2026-11");
  });
});

describe("usage storage", () => {
  let db: Db;
  beforeAll(async () => {
    db = drizzle(new PGlite(), { schema }) as unknown as Db;
    await migrate(runnerFor(db));
  });

  it("counts AI messages per month, including two at once", async () => {
    await Promise.all([countAiMessage(db, "p2", "2026-10"), countAiMessage(db, "p2", "2026-10")]);
    await countAiMessage(db, "p2", "2026-11");
    expect(await aiMessagesUsed(db, "p2", "2026-10")).toBe(2);
    expect(await aiMessagesUsed(db, "p2", "2026-11")).toBe(1);
    expect(await aiMessagesUsed(db, "nobody", "2026-10")).toBe(0);
  });

  it("counts a user's designs", async () => {
    await createDesign(db, "p3", "A");
    await createDesign(db, "p3", "B");
    await createDesign(db, "other", "C");
    expect(await designCount(db, "p3")).toBe(2);
  });
});
