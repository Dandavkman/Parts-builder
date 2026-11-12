import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { createDesign } from "../agent/store";
import { runnerFor, type Db } from "../db/client";
import { migrate } from "../db/migrations";
import * as schema from "../db/schema";
import { attachScan, createScan, markUploaded, scanForDesign } from "./store";

describe("scan store", () => {
  let db: Db;
  beforeAll(async () => {
    db = drizzle(new PGlite(), { schema }) as unknown as Db;
    await migrate(runnerFor(db));
  });

  it("returns null for a design with no scan (the query the agent runs on every message)", async () => {
    const designId = await createDesign(db, "u1", "Wing");
    expect(await scanForDesign(db, designId)).toBeNull();
  });

  it("attaches an uploaded scan and reads it back", async () => {
    const designId = await createDesign(db, "u1", "Wing");
    const scanId = await createScan(db, "u1", "wing.glb", 1234, (id) => `scans/u1/${id}/wing.glb`);
    expect(await attachScan(db, designId, scanId, "u1")).toBe(false);
    await markUploaded(db, scanId, "u1");
    expect(await attachScan(db, designId, scanId, "u2")).toBe(false);
    expect(await attachScan(db, designId, scanId, "u1")).toBe(true);
    expect(await scanForDesign(db, designId)).toEqual({ id: scanId, filename: "wing.glb", sizeBytes: 1234, status: "uploaded" });
  });
});
