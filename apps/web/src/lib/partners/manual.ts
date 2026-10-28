import type { Order } from "../orders/store";

/**
 * A print partner we can hand an order to (task B2.8). `manual` partners have no API: the Owner places the
 * order on the partner's website using the job sheet and pastes the partner's reference back. An `api`
 * partner would place the order itself and return the reference; none exists until the launch partner
 * is chosen (O2.1).
 */
export interface PrintPartner {
  id: string;
  name: string;
  adapter: "manual" | "api";
  /** Material ids the partner can make. */
  materials: string[];
  placeOrder(order: Order): Promise<{ partnerOrderRef: string | null; instructions: string }>;
}

/** One-page job sheet: what to order, in what material and quantity, and where it ships. Plain text. */
export function jobSheet(order: Order): string {
  const q = order.quoteSnapshot;
  const a = order.shippingAddress;
  const spec = order.specSnapshot as { name?: unknown };
  return [
    `JOB SHEET  order ${order.id}`,
    `Part: ${typeof spec.name === "string" ? spec.name : "(unnamed)"}  (design ${order.designId}, version ${order.version})`,
    `Material: ${q.materialName}`,
    `Quantity: ${q.quantity}`,
    `Partner: ${q.partnerName}   Lead time: about ${q.leadDays} days`,
    `Files: download STEP and STL from the admin order page (format=step, format=stl).`,
    `Ship to:`,
    `  ${a.name}`,
    `  ${a.line1}${a.line2 ? `, ${a.line2}` : ""}`,
    `  ${a.city}, ${a.region} ${a.postal_code}  ${a.country}`,
    `Customer confirmed not safety-critical: ${order.safetyConfirmedAt.toISOString()}`,
    `Paste the partner's order reference on the order page when placed.`,
  ].join("\n");
}

export function manualPartner(id: string, name: string, materials: string[]): PrintPartner {
  return {
    id,
    name,
    adapter: "manual",
    materials,
    async placeOrder(order) {
      return {
        partnerOrderRef: null,
        instructions: `Place this order on ${name}'s website using the job sheet below, then paste their order reference on the order page.\n\n${jobSheet(order)}`,
      };
    },
  };
}
