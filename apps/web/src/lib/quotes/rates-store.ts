import { eq } from "drizzle-orm";
import type { Db } from "../db/client";
import { rateCards } from "../db/schema";
import { DEFAULT_RATES, type RatesConfig } from "./rates-config";

/** The rates quotes are priced from: the admin's saved set, or the placeholder set until one is saved. */
export async function loadRates(db: Db): Promise<{ config: RatesConfig; source: "saved" | "placeholder" }> {
  const [row] = await db.select().from(rateCards).where(eq(rateCards.id, 1));
  return row ? { config: row.config, source: "saved" } : { config: DEFAULT_RATES, source: "placeholder" };
}

export async function saveRates(db: Db, config: RatesConfig, adminId: string): Promise<void> {
  await db
    .insert(rateCards)
    .values({ id: 1, config, updatedBy: adminId })
    .onConflictDoUpdate({ target: rateCards.id, set: { config, updatedBy: adminId, updatedAt: new Date() } });
}
