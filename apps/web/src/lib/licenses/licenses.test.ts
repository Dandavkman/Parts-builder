import { PGlite } from "@electric-sql/pglite";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { drizzle } from "drizzle-orm/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { runnerFor, type Db } from "../db/client";
import { migrate } from "../db/migrations";
import * as schema from "../db/schema";
import { setPlan } from "../plans-store";
import { memoryStorage } from "../storage/memory";
import { DownloadRefused } from "../storage/types";
import { accessFor, canUseScan, grantLicense } from "./licenses";

describe("scan licenses", () => {
  let db: Db;
  beforeAll(async () => {
    db = drizzle(new PGlite(), { schema }) as unknown as Db;
    await migrate(runnerFor(db));
  });

  it("grants a license for a scanned area, once", async () => {
    const first = await grantLicense(db, { ownerId: "u1", vehicleId: "mazda-mx5-na", area: "dash", source: "purchase", ref: "pay_1" });
    expect(first).toMatchObject({ ok: true, duplicate: false });
    expect(await grantLicense(db, { ownerId: "u1", vehicleId: "mazda-mx5-na", area: "dash", source: "admin" })).toMatchObject({ ok: true, duplicate: true });
  });

  it("refuses unknown cars, unknown areas and areas without a scan", async () => {
    expect(await grantLicense(db, { ownerId: "u1", vehicleId: "nope", area: "dash", source: "admin" })).toMatchObject({ ok: false, status: 404 });
    expect(await grantLicense(db, { ownerId: "u1", vehicleId: "mazda-mx5-na", area: "roof", source: "admin" })).toMatchObject({ ok: false, status: 400 });
    expect(await grantLicense(db, { ownerId: "u1", vehicleId: "mazda-mx5-na", area: "trunk", source: "admin" })).toMatchObject({ ok: false, status: 409 });
  });

  it("lets a license holder or a Pro user use a scanned area, nobody else", async () => {
    expect(await canUseScan(db, "u1", "mazda-mx5-na", "dash")).toBe(true);
    expect(await canUseScan(db, "u1", "mazda-mx5-na", "center-console")).toBe(false);
    expect(await canUseScan(db, "u2", "mazda-mx5-na", "dash")).toBe(false);
    await setPlan(db, "u3", "pro");
    expect(await canUseScan(db, "u3", "mazda-mx5-na", "center-console")).toBe(true);
    expect(await canUseScan(db, "u3", "mazda-mx5-na", "trunk")).toBe(false);
  });

  it("reports access per scanned area", async () => {
    expect(await accessFor(db, "u1", "mazda-mx5-na")).toEqual([
      { area: "dash", allowed: true, via: "license" },
      { area: "center-console", allowed: false, via: null },
    ]);
    expect((await accessFor(db, "u3", "mazda-mx5-na"))!.every((a) => a.via === "pro")).toBe(true);
    expect(await accessFor(db, "u1", "nope")).toBeNull();
  });
});

describe("library scans never reach the browser (plan rule 2)", () => {
  it("storage refuses a download link for any library key", async () => {
    await expect(memoryStorage().presignGet("library/mazda-mx5-na/dash.glb", 60)).rejects.toBeInstanceOf(DownloadRefused);
  });

  it("no page or API route touches file storage yet; one that does must be reviewed against rule 2", () => {
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const p = join(dir, name);
        if (statSync(p).isDirectory()) walk(p);
        else if (/\.(ts|tsx)$/.test(name) && !name.endsWith(".test.ts") && /lib\/storage|presignGet|ObjectStorage/.test(readFileSync(p, "utf8"))) offenders.push(p);
      }
    };
    walk(join(__dirname, "../../app"));
    expect(offenders).toEqual([]);
  });
});
