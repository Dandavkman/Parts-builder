import type { Order } from "../orders/store";

/**
 * How an order gets paid. The checkout route asks the provider to start a payment and the provider
 * (or its webhook) later calls `markPaid`. Providers:
 *   - "stub": no money moves; the order is marked paid at once. Only for development and demos, and
 *     refused in production unless PAYMENTS_STUB=1 is set on purpose.
 *   - Stripe arrives in B2.6b (test mode first); until then, production without PAYMENTS_STUB has no provider.
 */
export interface PaymentProvider {
  name: string;
  /** Starts the payment. `paidNow` means no redirect is needed and the order should be marked paid right away. */
  start(order: Order, origin: string): Promise<{ paidNow: true; ref: string } | { paidNow: false; url: string }>;
}

type Env = Record<string, string | undefined>;

export const stubProvider: PaymentProvider = {
  name: "stub",
  async start(order) {
    return { paidNow: true, ref: `stub_${order.id}` };
  },
};

/** The provider this environment may use, or null when payments are not enabled (checkout then answers 503). */
export function getPaymentProvider(env: Env = process.env): PaymentProvider | null {
  if (env.PAYMENTS_STUB === "1") return stubProvider;
  if (env.NODE_ENV !== "production") return stubProvider;
  return null;
}
