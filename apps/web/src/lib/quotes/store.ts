import { and, asc, eq, gt } from "drizzle-orm";
import type { Db } from "../db/client";
import { quotes } from "../db/schema";
import type { QuoteLine } from "./engine";
import { QUOTE_VALID_DAYS } from "./rate-cards";

export type StoredQuote = typeof quotes.$inferSelect;

/** Saves a set of quotes for one design version. Earlier unexpired quotes for the same version are kept so an order can still point at them. */
export async function saveQuotes(
  db: Db,
  designId: string,
  version: number,
  lines: QuoteLine[],
  now: Date = new Date(),
): Promise<StoredQuote[]> {
  if (!lines.length) return [];
  const expiresAt = new Date(now.getTime() + QUOTE_VALID_DAYS * 24 * 3600 * 1000);
  return db
    .insert(quotes)
    .values(lines.map((l) => ({ ...l, designId, version, expiresAt })))
    .returning();
}

/** Unexpired quotes for a version, cheapest first. */
export async function listQuotes(db: Db, designId: string, version: number, now: Date = new Date()): Promise<StoredQuote[]> {
  return db
    .select()
    .from(quotes)
    .where(and(eq(quotes.designId, designId), eq(quotes.version, version), gt(quotes.expiresAt, now)))
    .orderBy(asc(quotes.totalCents));
}

/** One quote if it belongs to the design and has not expired. */
export async function getQuote(db: Db, designId: string, quoteId: string, now: Date = new Date()): Promise<StoredQuote | null> {
  const [row] = await db
    .select()
    .from(quotes)
    .where(and(eq(quotes.id, quoteId), eq(quotes.designId, designId), gt(quotes.expiresAt, now)));
  return row ?? null;
}
