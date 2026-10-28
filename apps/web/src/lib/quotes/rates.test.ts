import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { runnerFor, type Db } from "../db/client";
import { migrate } from "../db/migrations";
import * as schema from "../db/schema";
import { buildQuotes } from "./engine";
import { DEFAULT_RATES, parseRates } from "./rates-config";
import { loadRates, saveRates } from "./rates-store";

const good = {
  markupPercent: 35,
  placeholder: false,
  partners: [{ id: "acme", name: "Acme Prints", shipping_cents: 900, materials: { pla: { per_cm3_cents: 7, setup_fee_cents: 250, min_part_cents: 350, lead_days: 4 } } }],
};

describe("parseRates", () => {
  it("accepts a complete set of rates", () => {
    const r = parseRates(good);
    expect(r.ok && r.config.partners[0].materials.pla.per_cm3_cents).toBe(7);
    expect(r.ok && r.config.placeholder).toBe(false);
  });

  it("lists every problem in plain words", () => {
    const r = parseRates({
      markupPercent: -1,
      partners: [
        { id: "Bad Id", name: "", shipping_cents: 1.5, materials: { unobtainium: {} } },
        { id: "ok-id", name: "Ok", shipping_cents: 0, materials: { pla: { per_cm3_cents: -1, setup_fee_cents: 0, min_part_cents: 0, lead_days: 1 } } },
        { id: "ok-id", name: "Twin", shipping_cents: 0, materials: {} },
      ],
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    const text = r.errors.join("\n");
    for (const part of ["markupPercent", "placeholder must be", "id must be", "name is required", "shipping_cents", "unknown material unobtainium", "whole numbers", "used twice", "offer at least one material"]) {
      expect(text).toContain(part);
    }
  });

  it("rejects anything that is not an object with partners", () => {
    expect(parseRates(null).ok).toBe(false);
    expect(parseRates({ ...good, partners: [] }).ok).toBe(false);
  });
});

describe("saved rates", () => {
  let db: Db;
  beforeAll(async () => {
    db = drizzle(new PGlite(), { schema }) as unknown as Db;
    await migrate(runnerFor(db));
  });

  it("falls back to the placeholders until rates are saved, then uses the saved set", async () => {
    expect(await loadRates(db)).toEqual({ config: DEFAULT_RATES, source: "placeholder" });
    const parsed = parseRates(good);
    if (!parsed.ok) throw new Error("setup");
    await saveRates(db, parsed.config, "admin_1");
    const loaded = await loadRates(db);
    expect(loaded.source).toBe("saved");
    expect(loaded.config.partners.map((p) => p.id)).toEqual(["acme"]);
  });

  it("replaces the set on a second save and prices quotes from it, marked as real", async () => {
    const parsed = parseRates({ ...good, markupPercent: 10 });
    if (!parsed.ok) throw new Error("setup");
    await saveRates(db, parsed.config, "admin_2");
    const { config } = await loadRates(db);
    expect(config.markupPercent).toBe(10);
    const spec = { features: [{ type: "plate", id: "a", thickness_mm: 3 }] };
    const { quotes } = buildQuotes({ volume_mm3: 20_000, size_mm: [50, 40, 10], spec, quantity: 1, partners: config.partners, markupPercent: config.markupPercent, placeholder: config.placeholder });
    expect(quotes).toHaveLength(1);
    expect(quotes[0]).toMatchObject({ partnerId: "acme", materialId: "pla", placeholder: false });
  });
});
