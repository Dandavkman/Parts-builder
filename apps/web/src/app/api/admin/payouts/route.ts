import { DatabaseNotConfigured, getDb } from "../../../../lib/db/client";
import { reportError } from "../../../../lib/observability";
import { requireAdmin } from "../../../../lib/require-admin";
import { balanceCents, recordPayout } from "../../../../lib/stores/ledger";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Records a payout to a seller. Body: `{ storeId, amountCents, ref, note? }`. Does not move money. */
export async function POST(request: Request) {
  const who = await requireAdmin();
  if ("response" in who) return who.response;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body.storeId !== "string" || !UUID.test(body.storeId)) return Response.json({ error: "storeId is required." }, { status: 400 });
  try {
    const db = await getDb();
    const result = await recordPayout(db, {
      storeId: body.storeId,
      amountCents: body.amountCents,
      ref: body.ref,
      adminId: who.adminId,
      note: typeof body.note === "string" ? body.note : undefined,
    });
    if (!result.ok) return Response.json({ error: result.error }, { status: result.status });
    return Response.json({ entry: result.entry, duplicate: result.duplicate, balanceCents: await balanceCents(db, body.storeId) }, { status: result.duplicate ? 200 : 201 });
  } catch (error) {
    if (!(error instanceof DatabaseNotConfigured)) await reportError("payout failed", error);
    return Response.json({ error: "The database is not available." }, { status: 503 });
  }
}
