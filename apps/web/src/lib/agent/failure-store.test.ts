import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { runnerFor, type Db } from "../db/client";
import { migrate } from "../db/migrations";
import * as schema from "../db/schema";
import { benchmarkCandidates, successRate, topFailures } from "./failure-report";
import { loadLoggedDesigns } from "./failure-store";
import { createDesign, recorderFor } from "./store";

describe("loading logged designs", () => {
  let db: Db;
  beforeAll(async () => {
    db = drizzle(new PGlite(), { schema }) as unknown as Db;
    await migrate(runnerFor(db));
    const spec = { spec_version: "1.1", features: [] };
    const usage = { input_tokens: 1, output_tokens: 1, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 };
    const good = recorderFor(db, await createDesign(db, "u1", "Stand"));
    await good.message({ role: "user", content: "a phone stand", model: "m", usage });
    await good.version({ spec, ok: true, errors: [], createdBy: "agent", anchors: [] });
    const bad = recorderFor(db, await createDesign(db, "u2", "Pod"));
    await bad.message({ role: "user", content: "a gauge pod", model: "m", usage });
    await bad.version({ spec, ok: false, errors: ["Hole 3 at 12 mm is outside the plate"], createdBy: "agent", anchors: [] });
  });

  it("feeds the report from the saved conversations and versions, without owner ids", async () => {
    const logged = await loadLoggedDesigns(db, new Date(Date.now() - 3600_000));
    expect(logged).toHaveLength(2);
    expect(JSON.stringify(logged)).not.toContain("u1");
    expect(successRate(logged)).toBe(0.5);
    const failures = topFailures(logged);
    expect(failures).toEqual([{ reason: "hole # at # mm is outside the plate", count: 1, examples: ["a gauge pod"] }]);
    expect(benchmarkCandidates(failures)[0].prompt).toBe("a gauge pod");
  });

  it("ignores designs older than the window", async () => {
    expect(await loadLoggedDesigns(db, new Date(Date.now() + 3600_000))).toEqual([]);
  });
});
