import { DatabaseNotConfigured, getDb } from "../../../../lib/db/client";
import { parseRates } from "../../../../lib/quotes/rates-config";
import { loadRates, saveRates } from "../../../../lib/quotes/rates-store";
import { requireAdmin } from "../../../../lib/require-admin";

const unavailable = (error: unknown) => {
  if (!(error instanceof DatabaseNotConfigured)) console.error("database unavailable", error);
  return Response.json({ error: "The database is not available." }, { status: 503 });
};

/** The rates quotes are priced from now, and whether they are the saved set or the built-in placeholders. */
export async function GET() {
  const who = await requireAdmin();
  if ("response" in who) return who.response;
  try {
    return Response.json(await loadRates(await getDb()), { headers: { "cache-control": "private, no-store" } });
  } catch (error) {
    return unavailable(error);
  }
}

/**
 * Replaces the rates. Body: `{ markupPercent, placeholder, partners: [{ id, name, shipping_cents, materials: { <materialId>: { per_cm3_cents, setup_fee_cents, min_part_cents, lead_days } } }] }`.
 * Send `placeholder: false` only when these are real, confirmed rates; it lets live payments through.
 */
export async function PUT(request: Request) {
  const who = await requireAdmin();
  if ("response" in who) return who.response;
  const parsed = parseRates(await request.json().catch(() => null));
  if (!parsed.ok) return Response.json({ error: "Check the rates.", errors: parsed.errors }, { status: 400 });
  try {
    await saveRates(await getDb(), parsed.config, who.adminId);
    return Response.json({ ok: true });
  } catch (error) {
    return unavailable(error);
  }
}
