import { formatCents } from "../quotes/engine";

/** The emails an order can trigger (plan B2.9). */
export type OrderEmailEvent = "order_confirmed" | "sent_to_production" | "shipped" | "delivered" | "review_approved" | "review_rejected";

export interface OrderEmailData {
  orderId: string;
  materialName: string;
  quantity: number;
  totalCents: number;
  trackingNumber?: string | null;
  /** True while prices are placeholders, so a test email cannot be mistaken for a real receipt. */
  placeholder: boolean;
}

export interface EmailContent {
  subject: string;
  text: string;
}

const line = (d: OrderEmailData) => `${d.quantity} x custom part in ${d.materialName}, ${formatCents(d.totalCents)} (order ${d.orderId})`;

export function renderOrderEmail(event: OrderEmailEvent, d: OrderEmailData): EmailContent {
  const test = d.placeholder ? "[TEST - example prices] " : "";
  switch (event) {
    case "order_confirmed":
      return { subject: `${test}We received your order`, text: `Thanks for your order.\n\n${line(d)}\n\nWe will email you when it goes to production and when it ships.` };
    case "sent_to_production":
      return { subject: `${test}Your part is being made`, text: `Your order has gone to production.\n\n${line(d)}` };
    case "shipped":
      return {
        subject: `${test}Your order has shipped`,
        text: `Your order is on its way.\n\n${line(d)}${d.trackingNumber ? `\nTracking number: ${d.trackingNumber}` : ""}`,
      };
    case "delivered":
      return { subject: `${test}Your order was delivered`, text: `Your order has been delivered.\n\n${line(d)}\n\nIf it does not fit as designed, reply to this email and we will make it right.` };
    case "review_approved":
      return { subject: `${test}Your design was approved`, text: `A person reviewed your design and approved it. Your order is moving on to production.\n\n${line(d)}` };
    case "review_rejected":
      return { subject: `${test}We cannot make your design`, text: `A person reviewed your design and we are not able to make it. Your order will be refunded.\n\n${line(d)}` };
  }
}

/** Which email a move between statuses sends, if any. A move out of review is the review's outcome. */
export function eventForMove(from: string, to: string): OrderEmailEvent | null {
  if (from === "in_review") {
    if (to === "sent_to_partner") return "review_approved";
    if (to === "cancelled" || to === "refunded") return "review_rejected";
  }
  if (to === "in_production") return "sent_to_production";
  if (to === "shipped") return "shipped";
  if (to === "delivered") return "delivered";
  return null;
}
