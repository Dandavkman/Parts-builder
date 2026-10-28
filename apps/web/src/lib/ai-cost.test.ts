import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { costReport, costUsd, FALLBACK_PRICE, MODEL_PRICES, recentUserMessages } from "./ai-cost";
import { createDesign, recorderFor } from "./agent/store";
import { runnerFor, type Db } from "./db/client";
import { migrate } from "./db/migrations";
import * as schema from "./db/schema";

describe("costUsd", () => {
  it("adds input, output and cache tokens at the model's prices", () => {
    const p = MODEL_PRICES["claude-sonnet-5-5"];
    const usd = costUsd("claude-sonnet-5-5", { input: 1_000_000, output: 1_000_000, cacheWrite: 1_000_000, cacheRead: 1_000_000 });
    expect(usd).toBeCloseTo(p.inputPerMTok + p.outputPerMTok + p.cacheWritePerMTok + p.cacheReadPerMTok, 6);
  });

  it("never prices an unknown model at zero", () => {
    expect(costUsd("mystery-model", { input: 1_000_000, output: 0, cacheWrite: 0, cacheRead: 0 })).toBeCloseTo(FALLBACK_PRICE.inputPerMTok, 6);
    expect(costUsd(null, { input: 0, output: 1_000_000, cacheWrite: 0, cacheRead: 0 })).toBeCloseTo(FALLBACK_PRICE.outputPerMTok, 6);
  });
});

describe("reports from stored messages", () => {
  let db: Db;
  beforeAll(async () => {
    db = drizzle(new PGlite(), { schema }) as unknown as Db;
    await migrate(runnerFor(db));
  });

  const usage = (input: number, output: number) => ({ input_tokens: input, output_tokens: output, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 });

  async function chat(owner: string, title: string, turns: [number, number][]) {
    const id = await createDesign(db, owner, title);
    const rec = recorderFor(db, id);
    for (const [i, o] of turns) {
      await rec.message({ role: "user", content: "make a thing" });
      await rec.message({ role: "assistant", content: [{ type: "text", text: "ok" }], model: "claude-sonnet-5-5", usage: usage(i, o) });
    }
    return id;
  }

  it("ranks designs and users by cost and totals them", async () => {
    await chat("cheap", "Small", [[1000, 100]]);
    await chat("rich", "Big", [[500_000, 50_000], [500_000, 50_000]]);
    const report = await costReport(db, new Date(Date.now() - 3600_000));
    expect(report.byDesign[0].title).toBe("Big");
    expect(report.byDesign[0].messages).toBe(2);
    expect(report.byUser[0].ownerId).toBe("rich");
    expect(report.totalUsd).toBeCloseTo(report.byDesign.reduce((s, d) => s + d.costUsd, 0), 9);
    expect(report.estimates).toBe(true);
  });

  it("leaves out spend before the start date", async () => {
    const report = await costReport(db, new Date(Date.now() + 3600_000));
    expect(report.totalUsd).toBe(0);
    expect(report.byDesign).toEqual([]);
  });

  it("counts a user's recent messages across their designs only", async () => {
    await chat("fast", "A", [[1, 1], [1, 1]]);
    await chat("fast", "B", [[1, 1]]);
    await chat("other", "C", [[1, 1]]);
    const since = new Date(Date.now() - 60_000);
    expect(await recentUserMessages(db, "fast", since)).toBe(3);
    expect(await recentUserMessages(db, "nobody", since)).toBe(0);
    expect(await recentUserMessages(db, "fast", new Date(Date.now() + 60_000))).toBe(0);
  });
});
