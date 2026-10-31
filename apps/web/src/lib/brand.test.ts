import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { describe, expect, it } from "vitest";
import { BRAND, ETYMOLOGY, FAQ, STEPS } from "./brand";
import { runnerFor, type Db } from "./db/client";
import { migrate } from "./db/migrations";
import * as schema from "./db/schema";

describe("public copy", () => {
  it("follows the storyboard's six steps in order", () => {
    expect(STEPS).toHaveLength(6);
    expect(STEPS[0].options).toEqual(["Tell us your measurements", "Take a picture", "Tell us what you're building on and we'll research the platform"]);
    expect(STEPS[3].title).toMatch(/quotes/i);
    expect(STEPS[5].title).toMatch(/sell/i);
  });

  it("has a name, a tagline and answers for every question", () => {
    expect(BRAND.name && BRAND.tagline).toBeTruthy();
    for (const f of FAQ) expect(f.a.length).toBeGreaterThan(20);
  });

  it("is called Ktiso and explains where the name comes from", () => {
    expect(BRAND.name).toBe("Ktiso");
    expect(ETYMOLOGY.greek).toBe("κτίζω");
    expect(ETYMOLOGY.meaning).toBe("to create");
    expect(ETYMOLOGY.senses).toHaveLength(2);
  });

  it("lists what cannot be ordered without promising a policy that does not exist", () => {
    const text = FAQ.map((f) => f.a).join(" ");
    expect(text).toMatch(/brakes/);
    expect(text).toMatch(/still being written/);
  });
});

describe("waitlist table", () => {
  it("keeps one row per address", async () => {
    const db = drizzle(new PGlite(), { schema }) as unknown as Db;
    await migrate(runnerFor(db));
    await db.insert(schema.waitlist).values({ email: "a@b.co" }).onConflictDoNothing();
    await db.insert(schema.waitlist).values({ email: "a@b.co" }).onConflictDoNothing();
    expect(await db.select().from(schema.waitlist)).toHaveLength(1);
  });
});
