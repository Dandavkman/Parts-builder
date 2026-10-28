import { eq, and } from "drizzle-orm";
import type { Db } from "../db/client";
import { emailLog } from "../db/schema";
import type { Order } from "../orders/store";
import { orderBrand } from "./order-brand";
import { getMailer, type Mailer } from "./mailer";
import { renderOrderEmail, type OrderEmailEvent } from "./templates";
import { reportError } from "../observability";

/**
 * Emails the customer about an order event, once. The log row is claimed first, so two callers (a repeated
 * webhook) cannot both send. If sending fails the claim is released so a retry can send it. Never throws:
 * a mail problem must not break an order. Returns what happened.
 */
export async function notifyOrder(db: Db, order: Order, event: OrderEmailEvent, mailer: Mailer = getMailer()): Promise<"sent" | "skipped" | "failed"> {
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
