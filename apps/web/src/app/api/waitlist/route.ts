import { eq } from "drizzle-orm";
import { DatabaseNotConfigured, getDb } from "../../../lib/db/client";
import { waitlist } from "../../../lib/db/schema";
import { clientKey, hit, LIMITS, tooMany } from "../../../lib/rate-limit";
import { reportError } from "../../../lib/observability";
import { normalizeEmail } from "../../../lib/waitlist/emails";

async function readEmail(request: Request) {
  const body = (await request.json().catch(() => null)) as { email?: unknown } | null;
  return normalizeEmail(body?.email);
}

async function handle(request: Request, action: (email: string, db: Awaited<ReturnType<typeof getDb>>) => Promise<Response>) {
  const email = await readEmail(request);
  if (!email) return Response.json({ error: "That email address does not look right." }, { status: 400 });
  try {
    const db = await getDb();
    const limited = await hit(db, LIMITS.waitlist, clientKey(request));
    if (!limited.ok) return tooMany(limited);
    return await action(email, db);
  } catch (error) {
    if (!(error instanceof DatabaseNotConfigured)) await reportError("waitlist failed", error);
    return Response.json({ error: "We could not save that right now. Please try again later." }, { status: 503 });
  }
}

/** Public. Adds an email to the waitlist. Body: `{ email }`. Answers the same whether or not the address was already there. */
export async function POST(request: Request) {
  return handle(request, async (email, db) => {
    await db.insert(waitlist).values({ email }).onConflictDoNothing();
    return Response.json({ ok: true }, { status: 201 });
  });
}

/** Public. Removes an email from the waitlist. Body: `{ email }`. Answers the same whether or not it was there, so it does not reveal who signed up. */
export async function DELETE(request: Request) {
  return handle(request, async (email, db) => {
    await db.delete(waitlist).where(eq(waitlist.email, email));
    return Response.json({ ok: true });
  });
}
