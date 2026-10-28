import { DatabaseNotConfigured, getDb } from "../../../../../lib/db/client";
import { reportError } from "../../../../../lib/observability";
import { requireAdmin } from "../../../../../lib/require-admin";
import { reviewListing } from "../../../../../lib/stores/review";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Approves or rejects a listing. Body: `{ decision: "approve" | "reject", note?, checks?: { notFactoryCopy, noTrademark } }`. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const who = await requireAdmin();
  if ("response" in who) return who.response;
  const { id } = await params;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!UUID.test(id) || !body) return Response.json({ error: "A listing id and a body are required." }, { status: 400 });
  try {
    const result = await reviewListing(await getDb(), {
      listingId: id,
      adminId: who.adminId,
      decision: body.decision,
      note: body.note,
      checks: typeof body.checks === "object" && body.checks !== null ? (body.checks as Record<string, unknown>) : undefined,
    });
    return result.ok ? Response.json({ listing: result.listing }) : Response.json({ error: result.error }, { status: result.status });
  } catch (error) {
    if (!(error instanceof DatabaseNotConfigured)) await reportError("listing review failed", error);
    return Response.json({ error: "The database is not available." }, { status: 503 });
  }
}
