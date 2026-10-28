import { buildFile } from "../../../../../lib/agent/geometry-client";
import { stlBounds, stlVolumeMm3 } from "../../../../../lib/agent/stl";
import { DatabaseNotConfigured, getDb } from "../../../../../lib/db/client";
import { validEmail } from "../../../../../lib/email/mailer";
import { notifyOrder } from "../../../../../lib/email/notify";
import { reportError } from "../../../../../lib/observability";
import { parseAddress } from "../../../../../lib/orders/address";
import { markPaid } from "../../../../../lib/orders/store";
import { getPaymentProvider } from "../../../../../lib/payments/provider";
import { buildQuotes } from "../../../../../lib/quotes/engine";
import { loadRates } from "../../../../../lib/quotes/rates-store";
import { hit, LIMITS, tooMany } from "../../../../../lib/rate-limit";
import { requireOwner } from "../../../../../lib/require-owner";
import { createStoreOrder, listingPart } from "../../../../../lib/stores/checkout";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const REFUSALS = {
  not_found: [404, "Listing not found."],
  not_for_sale: [404, "That listing is not for sale."],
  blocked: [403, "This design is in a category we do not make."],
  not_confirmed: [400, "Confirm the part is not safety-critical and accept the fit terms to order."],
  wrong_material: [409, "That material is not available for this listing."],
  price_changed: [409, "Making this part now costs more than the seller's price. The seller needs to update the listing."],
  version_missing: [409, "That version of the design is not available."],
} as const;

/**
 * Buys one unit of a store listing at its retail price. Body: `{ shipping, email?, confirmNotSafetyCritical, acceptFitTerms }`.
 * The part is re-measured and re-quoted with the cheapest partner so fulfillment has a real partner job.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const who = await requireOwner();
  if ("response" in who) return who.response;
  const { id } = await params;
  if (!UUID.test(id)) return Response.json({ error: "Not a listing." }, { status: 400 });
  const provider = getPaymentProvider();
  if (!provider) return Response.json({ error: "Ordering is not open yet." }, { status: 503 });
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const address = parseAddress(body?.shipping);
  if (!address.ok) return Response.json({ error: "Check the shipping address.", errors: address.errors }, { status: 400 });
  if (body?.email !== undefined && body.email !== "" && !validEmail(body.email)) return Response.json({ error: "That email address does not look right." }, { status: 400 });

  try {
    const db = await getDb();
    const limited = await hit(db, LIMITS.orders, who.ownerId);
    if (!limited.ok) return tooMany(limited);
    const part = await listingPart(db, id);
    if (!part) return Response.json({ error: REFUSALS.not_found[1] }, { status: 404 });
    if (!part.buildOk) return Response.json({ error: REFUSALS.version_missing[1] }, { status: 409 });
    const built = await buildFile(part.spec, part.anchors, "stl").catch(() => null);
    if (!built) return Response.json({ error: "The geometry service is not reachable." }, { status: 502 });
    if (!built.ok) return Response.json({ error: "That design no longer builds.", errors: built.errors }, { status: 422 });
    const bounds = stlBounds(built.body);
    const volume_mm3 = stlVolumeMm3(built.body);
    if (!bounds || !volume_mm3) return Response.json({ error: "The built part has no volume to quote." }, { status: 422 });
    const size_mm = [0, 1, 2].map((i) => bounds.max[i] - bounds.min[i]) as [number, number, number];
    const { config } = await loadRates(db);
    const { quotes } = buildQuotes({ volume_mm3, size_mm, spec: part.spec, quantity: 1, partners: config.partners, markupPercent: config.markupPercent, placeholder: config.placeholder });
    const line = quotes.find((q) => q.materialId === part.listing.materialId);
    if (!line) return Response.json({ error: REFUSALS.wrong_material[1] }, { status: 409 });

    const created = await createStoreOrder(db, {
      buyerId: who.ownerId,
      listingId: id,
      line,
      address: address.address,
      contactEmail: typeof body?.email === "string" && body.email ? body.email : undefined,
      confirmedNotSafetyCritical: body?.confirmNotSafetyCritical === true,
      acceptedFitTerms: body?.acceptFitTerms === true,
    });
    if (!created.ok) {
      const [status, error] = REFUSALS[created.reason];
      return Response.json({ error }, { status });
    }
    let started;
    try {
      started = await provider.start(created.order, new URL(request.url).origin);
    } catch (error) {
      await reportError("payment could not start", error);
      return Response.json({ error: "Payment could not be started. Try again in a moment." }, { status: 502 });
    }
    if (started.paidNow) {
      const paid = await markPaid(db, created.order.id, { provider: provider.name, ref: started.ref });
      if (paid) await notifyOrder(db, paid, "order_confirmed");
      return Response.json({ order: paid }, { status: 201 });
    }
    return Response.json({ order: created.order, checkoutUrl: started.url }, { status: 201 });
  } catch (error) {
    if (!(error instanceof DatabaseNotConfigured)) await reportError("store order failed", error);
    return Response.json({ error: "The database is not available." }, { status: 503 });
  }
}
