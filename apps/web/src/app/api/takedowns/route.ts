import { DatabaseNotConfigured, getDb } from "../../../lib/db/client";
import { getMailer } from "../../../lib/email/mailer";
import { reportError } from "../../../lib/observability";
import { clientKey, hit, LIMITS, tooMany } from "../../../lib/rate-limit";
import { fileClaim } from "../../../lib/takedowns/takedowns";

/**
 * Public. Files an intellectual-property claim against a listing.
 * Body: `{ listingId, name, email, description, goodFaith: true }`. The claimant gets a receipt by email when email is set up.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return Response.json({ error: "A claim is required." }, { status: 400 });
  try {
    const db = await getDb();
    const limited = await hit(db, LIMITS.takedowns, clientKey(request));
    if (!limited.ok) return tooMany(limited);
    const result = await fileClaim(db, { listingId: body.listingId, name: body.name, email: body.email, description: body.description, goodFaith: body.goodFaith });
    if (!result.ok) return Response.json({ error: result.error }, { status: result.status });
    await getMailer()
      .send({
        to: result.claim.claimantEmail,
        subject: "We received your claim",
        text: `We received your intellectual property claim (reference ${result.claim.id}). A person will review it, and we will contact you at this address if we need more.`,
      })
      .catch((error) => reportError("takedown receipt failed", error));
    return Response.json({ received: true, reference: result.claim.id }, { status: 201 });
  } catch (error) {
    if (!(error instanceof DatabaseNotConfigured)) await reportError("takedown claim failed", error);
    return Response.json({ error: "We could not save that right now. Please try again later." }, { status: 503 });
  }
}
