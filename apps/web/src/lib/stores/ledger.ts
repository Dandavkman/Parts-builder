import { and, desc, eq, sql } from "drizzle-orm";
import type { Db } from "../db/client";
import { ledgerEntries, listings } from "../db/schema";
import { STORE_FEES_ARE_PLACEHOLDER } from "./royalty";

export type LedgerEntry = typeof ledgerEntries.$inferSelect;
type Result = { ok: true; entry: LedgerEntry; duplicate: boolean } | { ok: false; error: string; status: number };

/** Adds one row, or returns the row already recorded for the same (store, kind, ref). */
async function append(db: Db, values: typeof ledgerEntries.$inferInsert): Promise<{ entry: LedgerEntry; duplicate: boolean }> {
  const [created] = await db.insert(ledgerEntries).values(values).onConflictDoNothing().returning();
  if (created) return { entry: created, duplicate: false };
  const [existing] = await db
    .select()
    .from(ledgerEntries)
    .where(and(eq(ledgerEntries.storeId, values.storeId), eq(ledgerEntries.kind, values.kind), eq(ledgerEntries.ref, values.ref)));
  return { entry: existing, duplicate: true };
}

/**
 * Credits the seller's royalty for one sold unit of a listing. `ref` names the sale (an order id), so the
 * same sale is never credited twice. The amount is the listing's royalty as fixed when it was listed.
 */
export async function recordSale(db: Db, input: { listingId: string; ref: string }): Promise<Result> {
  const [listing] = await db.select().from(listings).where(eq(listings.id, input.listingId));
  if (!listing) return { ok: false, error: "Listing not found.", status: 404 };
  const { entry, duplicate } = await append(db, {
    storeId: listing.storeId,
    listingId: listing.id,
    kind: "royalty",
    ref: input.ref,
    amountCents: listing.royaltyCents,
    placeholder: listing.placeholder || STORE_FEES_ARE_PLACEHOLDER,
  });
  return { ok: true, entry, duplicate };
}

/** Takes back the royalty of a refunded sale. Only a sale that was credited can be refunded. */
export async function recordRefund(db: Db, input: { listingId: string; ref: string }): Promise<Result> {
  const [listing] = await db.select().from(listings).where(eq(listings.id, input.listingId));
  if (!listing) return { ok: false, error: "Listing not found.", status: 404 };
  const [sale] = await db
    .select()
    .from(ledgerEntries)
    .where(and(eq(ledgerEntries.storeId, listing.storeId), eq(ledgerEntries.kind, "royalty"), eq(ledgerEntries.ref, input.ref)));
  if (!sale) return { ok: false, error: "That sale was never credited.", status: 409 };
  const { entry, duplicate } = await append(db, {
    storeId: listing.storeId,
    listingId: listing.id,
    kind: "refund",
    ref: input.ref,
    amountCents: -sale.amountCents,
    placeholder: sale.placeholder,
  });
  return { ok: true, entry, duplicate };
}

export async function balanceCents(db: Db, storeId: string): Promise<number> {
  const [row] = await db
    .select({ total: sql<string>`coalesce(sum(${ledgerEntries.amountCents}), 0)` })
    .from(ledgerEntries)
    .where(eq(ledgerEntries.storeId, storeId));
  return Number(row?.total ?? 0);
}

/**
 * Records money paid out to a seller. It never exceeds what is owed. Sending the money is done outside the
 * app until Stripe Connect is on (B4.1); `ref` is the transfer or bank reference, so a payout is recorded once.
 */
export async function recordPayout(
  db: Db,
  input: { storeId: string; amountCents: unknown; ref: unknown; adminId: string; note?: string },
): Promise<Result> {
  const amount = input.amountCents;
  if (typeof amount !== "number" || !Number.isInteger(amount) || amount <= 0) return { ok: false, error: "The amount must be a whole number of cents above zero.", status: 400 };
  if (typeof input.ref !== "string" || !input.ref.trim() || input.ref.length > 100) return { ok: false, error: "A payout reference is required.", status: 400 };
  const ref = input.ref.trim();
  const [existing] = await db
    .select()
    .from(ledgerEntries)
    .where(and(eq(ledgerEntries.storeId, input.storeId), eq(ledgerEntries.kind, "payout"), eq(ledgerEntries.ref, ref)));
  if (existing) return { ok: true, entry: existing, duplicate: true };
  if (amount > (await balanceCents(db, input.storeId))) return { ok: false, error: "That is more than the store is owed.", status: 409 };
  const { entry, duplicate } = await append(db, {
    storeId: input.storeId,
    kind: "payout",
    ref,
    amountCents: -amount,
    placeholder: STORE_FEES_ARE_PLACEHOLDER,
    note: input.note?.slice(0, 200) ?? null,
    createdBy: input.adminId,
  });
  return { ok: true, entry, duplicate };
}

export async function ledgerFor(db: Db, storeId: string, limit = 100): Promise<LedgerEntry[]> {
  return db.select().from(ledgerEntries).where(eq(ledgerEntries.storeId, storeId)).orderBy(desc(ledgerEntries.createdAt)).limit(limit);
}
