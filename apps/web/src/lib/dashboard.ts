import { formatCents } from "./quotes/engine";

export const STATUS_LABELS: Record<string, string> = {
  quote: "Awaiting payment",
  paid: "Paid",
  in_review: "In safety review",
  sent_to_partner: "Sent to print partner",
  in_production: "Being made",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
  refunded: "Refunded",
  reprint: "Being reprinted",
};

export function statusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status;
}

/** Keeps rows whose text contains every word of the search, ignoring case. An empty search keeps everything. */
export function matches(text: string, search: string | undefined): boolean {
  const words = (search ?? "").toLowerCase().split(/\s+/).filter(Boolean);
  const haystack = text.toLowerCase();
  return words.every((w) => haystack.includes(w));
}

export interface OrderRow {
  id: string;
  designId: string;
  version: number;
  status: string;
  totalCents: number;
  quoteSnapshot: { materialName: string; partnerName: string; quantity: number };
  trackingNumber: string | null;
  createdAt: Date;
}

/** The text an order search looks in: material, status label and tracking number. */
export function orderText(o: OrderRow): string {
  return [o.quoteSnapshot.materialName, statusLabel(o.status), o.trackingNumber ?? "", o.id].join(" ");
}

export function orderSummary(o: OrderRow): string {
  const q = o.quoteSnapshot;
  return `${q.quantity} x ${q.materialName}, ${formatCents(o.totalCents)}`;
}
