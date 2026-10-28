import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { createDesign } from "../agent/store";
import { runnerFor, type Db } from "../db/client";
import { migrate } from "../db/migrations";
import * as schema from "../db/schema";
import { buildQuotes } from "./engine";
import { getQuote, listQuotes, saveQuotes } from "./store";

let db: Db;
beforeAll(async () => {
  db = drizzle(new PGlite(), { schema }) as unknown as Db;
  await migrate(runnerFor(db));
});

const spec = { features: [{ type: "plate", id: "a", thickness_mm: 3 }] };

describe("quote storage", () => {
  it("saves every component, lists cheapest first, and drops quotes after 14 days", async () => {
    const designId = await createDesign(db, "q-owner", "Bracket");
    const { quotes } = buildQuotes({ volume_mm3: 20_000, size_mm: [50, 40, 10], spec, quantity: 2 });
    const start = new Date("2026-10-28T12:00:00Z");
    const saved = await saveQuotes(db, designId, 1, quotes, start);
    expect(saved).toHaveLength(quotes.length);
    expect(saved[0].expiresAt.toISOString()).toBe("2026-11-11T12:00:00.000Z");

    const listed = await listQuotes(db, designId, 1, new Date("2026-11-01T00:00:00Z"));
    expect(listed.map((q) => q.totalCents)).toEqual(listed.map((q) => q.totalCents).sort((a, b) => a - b));
    expect(listed[0].partnerCostCents + listed[0].markupCents + listed[0].shippingCents + listed[0].paymentFeeCents).toBe(listed[0].totalCents);

    expect(await listQuotes(db, designId, 1, new Date("2026-11-12T00:00:00Z"))).toEqual([]);
    expect(await getQuote(db, designId, saved[0].id, new Date("2026-11-12T00:00:00Z"))).toBeNull();
    expect((await getQuote(db, designId, saved[0].id, new Date("2026-11-01T00:00:00Z")))?.id).toBe(saved[0].id);
  });

  it("will not return a quote through another design", async () => {
    const a = await createDesign(db, "q-owner", "A");
    const b = await createDesign(db, "q-owner", "B");
    const { quotes } = buildQuotes({ volume_mm3: 20_000, size_mm: [50, 40, 10], spec, quantity: 1 });
    const [first] = await saveQuotes(db, a, 1, quotes);
    expect(await getQuote(db, b, first.id)).toBeNull();
  });
});
