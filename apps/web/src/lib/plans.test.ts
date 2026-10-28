import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { createDesign } from "./agent/store";
import { runnerFor, type Db } from "./db/client";
import { migrate } from "./db/migrations";
import * as schema from "./db/schema";
import { checkAiMessage, checkNewDesign, checkStepExport, PLAN_LIMITS, periodOf, plansEnforced } from "./plans";
import { aiMessagesUsed, countAiMessage, designCount, getPlan, setPlan } from "./plans-store";

describe("plan checks", () => {
  it("stops AI messages at the monthly limit and offers an upgrade", () => {
    const limit = PLAN_LIMITS.free.aiMessagesPerMonth;
    expect(checkAiMessage("free", limit - 1)).toEqual({ ok: true });
    const r = checkAiMessage("free", limit);
    expect(r).toMatchObject({ ok: false, upgrade: true });
    expect(checkAiMessage("pro", limit)).toEqual({ ok: true });
  });

  it("limits saved designs", () => {
    expect(checkNewDesign("free", PLAN_LIMITS.free.savedDesigns - 1).ok).toBe(true);
    expect(checkNewDesign("free", PLAN_LIMITS.free.savedDesigns).ok).toBe(false);
    expect(checkNewDesign("pro", PLAN_LIMITS.free.savedDesigns).ok).toBe(true);
  });

  it("gates STEP export to Pro", () => {
    expect(checkStepExport("free").ok).toBe(false);
    expect(checkStepExport("pro").ok).toBe(true);
  });

  it("is off unless PLANS_ENFORCED=1, and counts months in UTC", () => {
    expect(plansEnforced({})).toBe(false);
    expect(plansEnforced({ PLANS_ENFORCED: "1" })).toBe(true);
    expect(periodOf(new Date("2026-10-31T23:59:59Z"))).toBe("2026-10");
    expect(periodOf(new Date("2026-11-01T00:00:00Z"))).toBe("2026-11");
  });
});

describe("plan storage", () => {
  let db: Db;
  beforeAll(async () => {
    db = drizzle(new PGlite(), { schema }) as unknown as Db;
    await migrate(runnerFor(db));
  });

  it("defaults to free and remembers a change", async () => {
    expect(await getPlan(db, "p1")).toBe("free");
    await setPlan(db, "p1", "pro");
    expect(await getPlan(db, "p1")).toBe("pro");
    await setPlan(db, "p1", "free");
    expect(await getPlan(db, "p1")).toBe("free");
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
