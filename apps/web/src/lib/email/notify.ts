import { eq, and } from "drizzle-orm";
import type { Db } from "../db/client";
import { emailLog } from "../db/schema";
import type { Order } from "../orders/store";
import { orderBrand } from "./order-brand";
import { getMailer, type Mailer } from "./mailer";
import { renderOrderEmail, type OrderEmailEvent } from "./templates";
import { reportError } from "../observability";
import { siteUrl } from "../site";
import { formatCents } from "../quotes/engine";

type Env = Record<string, string | undefined>;
const OWNER_EVENT = "owner_new_order";

/**
 * Tells the Owner a paid order has arrived, once per order, so it does not sit unseen until someone opens
 * /admin/orders. Goes to ORDER_ALERT_EMAIL; with that unset it does nothing. Never throws.
 */
export async function alertOwnerNewOrder(db: Db, order: Order, mailer: Mailer = getMailer(), env: Env = process.env): Promise<"sent" | "skipped" | "failed"> {
  const to = env.ORDER_ALERT_EMAIL?.trim();
  if (!to) return "skipped";
  try {
    const claimed = await db.insert(emailLog).values({ orderId: order.id, event: OWNER_EVENT }).onConflictDoNothing().returning({ orderId: emailLog.orderId });
    if (claimed.length === 0) return "skipped";
    try {
      const q = order.quoteSnapshot;
      const review = order.status === "in_review";
      await mailer.send({
        to,
        subject: `${q.placeholder ? "[TEST] " : ""}New paid order: ${q.quantity} x ${q.materialName}, ${formatCents(order.totalCents)}`,
        text: [
          `A paid order is waiting for you (order ${order.id}).`,
          `Part material: ${q.materialName}, quantity ${q.quantity}, total ${formatCents(order.totalCents)}.`,
          review ? "Its design needs a safety review before it can be made: approve or reject it first." : "Next: place it with a manufacturer using the job sheet, then paste their order reference.",
          `${siteUrl(env)}/admin/orders`,
        ].join("\n"),
      });
      return "sent";
    } catch (error) {
      await reportError("owner order alert failed", error);
      await db.delete(emailLog).where(and(eq(emailLog.orderId, order.id), eq(emailLog.event, OWNER_EVENT)));
      return "failed";
    }
  } catch (error) {
    await reportError("owner order alert log failed", error);
    return "failed";
  }
}

/**
 * Emails the customer about an order event, once. The log row is claimed first, so two callers (a repeated
 * webhook) cannot both send. If sending fails the claim is released so a retry can send it. Never throws:
 * a mail problem must not break an order. Returns what happened.
 */
export async function notifyOrder(db: Db, order: Order, event: OrderEmailEvent, mailer: Mailer = getMailer()): Promise<"sent" | "skipped" | "failed"> {
  if (event === "order_confirmed") await alertOwnerNewOrder(db, order);
  if (!order.contactEmail) return "skipped";
  try {
    const claimed = await db.insert(emailLog).values({ orderId: order.id, event }).onConflictDoNothing().returning({ orderId: emailLog.orderId });
    if (claimed.length === 0) return "skipped";
    try {
      const q = order.quoteSnapshot;
      const brand = await orderBrand(db, order);
      const content = renderOrderEmail(event, {
        orderId: order.id,
        materialName: q.materialName,
        quantity: q.quantity,
        totalCents: order.totalCents,
        trackingNumber: order.trackingNumber,
        placeholder: q.placeholder,
        brandName: brand.name,
        showPlatformBrand: brand.showPlatformBrand,
      });
      await mailer.send({ to: order.contactEmail, ...content, fromName: brand.name });
      return "sent";
    } catch (error) {
      await reportError("email failed", error);
      await db.delete(emailLog).where(and(eq(emailLog.orderId, order.id), eq(emailLog.event, event)));
      return "failed";
    }
  } catch (error) {
    await reportError("email log failed", error);
    return "failed";
  }
}
