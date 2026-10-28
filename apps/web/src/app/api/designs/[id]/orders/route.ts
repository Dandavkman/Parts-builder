import { notifyOrder } from "../../../../../lib/email/notify";
import { validEmail } from "../../../../../lib/email/mailer";
import { DatabaseNotConfigured, getDb } from "../../../../../lib/db/client";
import { parseAddress } from "../../../../../lib/orders/address";
import { createOrder, markPaid } from "../../../../../lib/orders/store";
import { getPaymentProvider } from "../../../../../lib/payments/provider";
import { requireOwner } from "../../../../../lib/require-owner";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const REFUSALS = {
  design_not_found: [404, "Design not found."],
  blocked: [403, "This design is in a category we do not make."],
  quote_not_found: [404, "Quote not found."],
  quote_expired: [409, "That quote has expired. Get a new quote."],
  not_confirmed: [400, "Confirm the part is not safety-critical and accept the fit terms to order."],
  version_missing: [409, "That version of the design is not available."],
} as const;

/**
 * Orders one quote. Body: `{ quoteId, shipping, confirmNotSafetyCritical, acceptFitTerms }`.
 * Both confirmations must be true; their time is stored with the order. Answers 503 when payments are not enabled.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const who = await requireOwner();
  if ("response" in who) return who.response;
  const { id } = await params;
  if (!UUID.test(id)) return Response.json({ error: "Not a design." }, { status: 400 });

  const provider = getPaymentProvider();
  if (!provider) return Response.json({ error: "Ordering is not open yet." }, { status: 503 });

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body.quoteId !== "string" || !UUID.test(body.quoteId)) {
    return Response.json({ error: "quoteId is required." }, { status: 400 });
  }
  const address = parseAddress(body.shipping);
  if (!address.ok) return Response.json({ error: "Check the shipping address.", errors: address.errors }, { status: 400 });

  if (body.email !== undefined && body.email !== "" && !validEmail(body.email)) return Response.json({ error: "That email address does not look right." }, { status: 400 });
  try {
    const db = await getDb();
    const created = await createOrder(db, {
      ownerId: who.ownerId,
      designId: id,
      quoteId: body.quoteId,
      address: address.address,
      contactEmail: typeof body.email === "string" && body.email ? body.email : undefined,
      confirmedNotSafetyCritical: body.confirmNotSafetyCritical === true,
      acceptedFitTerms: body.acceptFitTerms === true,
    });
    if (!created.ok) {
      const [status, error] = REFUSALS[created.reason];
      return Response.json({ error }, { status });
    }
    let started;
    try {
      started = await provider.start(created.order, new URL(request.url).origin);
    } catch (error) {
      console.error("payment could not start", error);
      return Response.json({ error: "Payment could not be started. Try again in a moment." }, { status: 502 });
    }
    if (started.paidNow) {
      const paid = await markPaid(db, created.order.id, { provider: provider.name, ref: started.ref });
      if (paid) await notifyOrder(db, paid, "order_confirmed");
      return Response.json({ order: paid }, { status: 201 });
    }
    return Response.json({ order: created.order, checkoutUrl: started.url }, { status: 201 });
  } catch (error) {
    if (!(error instanceof DatabaseNotConfigured)) console.error("order failed", error);
    return Response.json({ error: "The database is not available." }, { status: 503 });
  }
}
