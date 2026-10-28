import { and, desc, eq } from "drizzle-orm";
import type { Db } from "../db/client";
import { designs, designVersions, orders, quotes } from "../db/schema";
import type { QuoteLine } from "../quotes/engine";
import type { ShippingAddress } from "./address";
import { canMove, type OrderStatus } from "./status";

export type Order = typeof orders.$inferSelect;

export type CreateOrderResult =
  | { ok: true; order: Order }
  | { ok: false; reason: "design_not_found" | "blocked" | "quote_not_found" | "quote_expired" | "not_confirmed" | "version_missing" };

/**
 * Creates an order in status `quote` from one of the owner's unexpired quotes. Both confirmations
 * (not safety-critical, fit terms) must be true; their time is stored with the order.
 */
export async function createOrder(
  db: Db,
  input: {
    ownerId: string;
    designId: string;
    quoteId: string;
    address: ShippingAddress;
    confirmedNotSafetyCritical: boolean;
    acceptedFitTerms: boolean;
    now?: Date;
  },
): Promise<CreateOrderResult> {
  const now = input.now ?? new Date();
  if (!input.confirmedNotSafetyCritical || !input.acceptedFitTerms) return { ok: false, reason: "not_confirmed" };
  const [design] = await db
    .select()
    .from(designs)
    .where(and(eq(designs.id, input.designId), eq(designs.ownerId, input.ownerId)));
  if (!design) return { ok: false, reason: "design_not_found" };
  if (design.safetyStatus === "blocked") return { ok: false, reason: "blocked" };
  const [quote] = await db
    .select()
    .from(quotes)
    .where(and(eq(quotes.id, input.quoteId), eq(quotes.designId, input.designId)));
  if (!quote) return { ok: false, reason: "quote_not_found" };
  if (quote.expiresAt <= now) return { ok: false, reason: "quote_expired" };
  const [version] = await db
    .select()
    .from(designVersions)
    .where(and(eq(designVersions.designId, input.designId), eq(designVersions.version, quote.version)));
  if (!version || !version.buildOk) return { ok: false, reason: "version_missing" };

  const snapshot: QuoteLine = {
    partnerId: quote.partnerId,
    partnerName: quote.partnerName,
    materialId: quote.materialId,
    materialName: quote.materialName,
    quantity: quote.quantity,
    partnerPartsCents: quote.partnerPartsCents,
    setupFeeCents: quote.setupFeeCents,
    partnerCostCents: quote.partnerCostCents,
    markupCents: quote.markupCents,
    shippingCents: quote.shippingCents,
    paymentFeeCents: quote.paymentFeeCents,
    totalCents: quote.totalCents,
    leadDays: quote.leadDays,
    placeholder: quote.placeholder,
  };
  const [order] = await db
    .insert(orders)
    .values({
      ownerId: input.ownerId,
      designId: input.designId,
      version: quote.version,
      quoteId: quote.id,
      quoteSnapshot: snapshot,
      specSnapshot: version.spec,
      shippingAddress: input.address,
      totalCents: quote.totalCents,
      safetyConfirmedAt: now,
      termsAcceptedAt: now,
    })
    .returning();
  return { ok: true, order };
}

/**
 * Records a payment. Only an order in `quote` moves; a repeat of the same payment (a webhook sent twice) changes nothing.
 * A design that needs review goes to `in_review` instead of straight to the partner.
 */
export async function markPaid(
  db: Db,
  orderId: string,
  payment: { provider: string; ref: string },
  now: Date = new Date(),
): Promise<Order | null> {
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId));
  if (!order) return null;
  if (order.status !== "quote") return order;
  const [design] = await db.select().from(designs).where(eq(designs.id, order.designId));
  const next: OrderStatus = design?.safetyStatus === "needs_review" ? "in_review" : "paid";
  const [updated] = await db
    .update(orders)
    .set({ status: next, paymentProvider: payment.provider, paymentRef: payment.ref, paidAt: now, updatedAt: now })
    .where(and(eq(orders.id, orderId), eq(orders.status, "quote")))
    .returning();
  return updated ?? (await getOrder(db, orderId));
}

export async function getOrder(db: Db, orderId: string): Promise<Order | null> {
  const [row] = await db.select().from(orders).where(eq(orders.id, orderId));
  return row ?? null;
}

export async function getOwnedOrder(db: Db, orderId: string, ownerId: string): Promise<Order | null> {
  const [row] = await db.select().from(orders).where(and(eq(orders.id, orderId), eq(orders.ownerId, ownerId)));
  return row ?? null;
}

export async function listOwnedOrders(db: Db, ownerId: string): Promise<Order[]> {
  return db.select().from(orders).where(eq(orders.ownerId, ownerId)).orderBy(desc(orders.createdAt));
}

export type MoveResult = { ok: true; order: Order } | { ok: false; reason: "not_found" | "not_allowed" };

/** Moves an order to a new status if the plan's order flow allows it. Used by the admin console. */
export async function moveOrder(
  db: Db,
  orderId: string,
  to: OrderStatus,
  extra: { trackingNumber?: string; partnerOrderRef?: string } = {},
  now: Date = new Date(),
): Promise<MoveResult> {
  const order = await getOrder(db, orderId);
  if (!order) return { ok: false, reason: "not_found" };
  if (!canMove(order.status as OrderStatus, to)) return { ok: false, reason: "not_allowed" };
  const [updated] = await db
    .update(orders)
    .set({ status: to, updatedAt: now, ...extra })
    .where(and(eq(orders.id, orderId), eq(orders.status, order.status)))
    .returning();
  return updated ? { ok: true, order: updated } : { ok: false, reason: "not_allowed" };
}
