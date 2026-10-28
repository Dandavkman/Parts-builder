/** Order statuses from the plan's data model, and the moves between them. */
export const ORDER_STATUSES = [
  "quote",
  "paid",
  "in_review",
  "sent_to_partner",
  "in_production",
  "shipped",
  "delivered",
  "cancelled",
  "refunded",
  "reprint",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

const NEXT: Record<OrderStatus, OrderStatus[]> = {
  quote: ["paid", "cancelled"],
  // A design that needs review waits in in_review until an admin approves it.
  paid: ["in_review", "sent_to_partner", "refunded"],
  in_review: ["sent_to_partner", "cancelled", "refunded"],
  sent_to_partner: ["in_production", "cancelled", "refunded"],
  in_production: ["shipped", "refunded"],
  shipped: ["delivered", "reprint", "refunded"],
  delivered: ["reprint", "refunded"],
  reprint: ["sent_to_partner", "refunded"],
  cancelled: [],
  refunded: [],
};

export function canMove(from: OrderStatus, to: OrderStatus): boolean {
  return NEXT[from].includes(to);
}

/** The statuses an order can move to from `from` (empty for finished orders or unknown values). */
export function nextStatuses(from: string): OrderStatus[] {
  return isOrderStatus(from) ? [...NEXT[from]] : [];
}

export function isOrderStatus(value: unknown): value is OrderStatus {
  return typeof value === "string" && (ORDER_STATUSES as readonly string[]).includes(value);
}
