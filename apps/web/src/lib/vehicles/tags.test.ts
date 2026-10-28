import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { runnerFor, type Db } from "../db/client";
import { migrate } from "../db/migrations";
import * as schema from "../db/schema";
import { grantLicense } from "../licenses/licenses";
import { coveredVehicles, type Vehicle } from "./catalog";
import { ownedDesignsForVehicle, tagDesign, tagsFor } from "./tags";

describe("compatibility tags", () => {
  let db: Db;
  let mine: string;
  let other: string;
  beforeAll(async () => {
    db = drizzle(new PGlite(), { schema }) as unknown as Db;
    await migrate(runnerFor(db));
    [{ id: mine }] = await db.insert(schema.designs).values({ ownerId: "u1", title: "Gauge pod" }).returning({ id: schema.designs.id });
    [{ id: other }] = await db.insert(schema.designs).values({ ownerId: "u2", title: "Not yours" }).returning({ id: schema.designs.id });
    await grantLicense(db, { ownerId: "u1", vehicleId: "mazda-mx5-na", area: "dash", source: "admin" });
  });

  it("covers the car itself and the cars it shares scans with", () => {
    const list: Vehicle[] = [
      { id: "a", make: "A", model: "A", generation: "1", yearFrom: 2000, yearTo: 2001, scanned: ["dash"], alsoCovers: ["b", "missing"] },
      { id: "b", make: "A", model: "B", generation: "1", yearFrom: 2000, yearTo: 2001, scanned: [] },
    ];
    expect(coveredVehicles("a", list).map((v) => v.id)).toEqual(["a", "b"]);
    expect(coveredVehicles("zzz", list)).toEqual([]);
  });

  it("tags a design from a scan the owner holds, once, and finds it by car", async () => {
    expect(await tagDesign(db, "u1", mine, "mazda-mx5-na", "dash")).toEqual({ ok: true, vehicleIds: ["mazda-mx5-na"] });
    expect(await tagDesign(db, "u1", mine, "mazda-mx5-na", "dash")).toMatchObject({ ok: true });
    expect(await tagsFor(db, mine)).toEqual(["mazda-mx5-na"]);
    expect((await ownedDesignsForVehicle(db, "u1", "mazda-mx5-na")).map((d) => d.title)).toEqual(["Gauge pod"]);
    expect(await ownedDesignsForVehicle(db, "u1", "honda-civic-ek")).toEqual([]);
    expect(await ownedDesignsForVehicle(db, "u2", "mazda-mx5-na")).toEqual([]);
  });

  it("refuses someone else's design, a scan the user does not hold, and bad input", async () => {
    expect(await tagDesign(db, "u1", other, "mazda-mx5-na", "dash")).toMatchObject({ ok: false, status: 404 });
    expect(await tagDesign(db, "u1", mine, "mazda-mx5-na", "center-console")).toMatchObject({ ok: false, status: 403 });
    expect(await tagDesign(db, "u1", mine, "nope", "dash")).toMatchObject({ ok: false, status: 404 });
    expect(await tagDesign(db, "u1", mine, "mazda-mx5-na", "roof")).toMatchObject({ ok: false, status: 400 });
  });
});
