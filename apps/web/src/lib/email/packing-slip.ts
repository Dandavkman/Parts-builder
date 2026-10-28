import { BRAND } from "../brand";
import type { Order } from "../orders/store";
import type { OrderBrand } from "./order-brand";

/**
 * Plain-text packing slip. It names the seller's store, not us, unless the seller allows our name. It shows what
 * is in the box and where it goes, never prices or the manufacturer.
 */
export function renderPackingSlip(order: Order, brand: OrderBrand): string {
  const a = order.shippingAddress;
  const q = order.quoteSnapshot;
  const lines = [
    brand.name ?? BRAND.name,
    "PACKING SLIP",
    "",
    `Order: ${order.id}`,
    "",
    "Ship to:",
    a.name,
    a.line1,
    ...(a.line2 ? [a.line2] : []),
    `${a.city}, ${a.region} ${a.postal_code}`,
    a.country,
    "",
    `Contents: ${q.quantity} x custom part in ${q.materialName}`,
  ];
  if (brand.name && brand.showPlatformBrand) lines.push("", `Made by ${BRAND.name}`);
  return lines.join("\n");
}
