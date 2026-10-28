import { DatabaseNotConfigured, getDb } from "../../../lib/db/client";
import { waitlist } from "../../../lib/db/schema";

/** Public. Adds an email to the waitlist. Body: `{ email }`. Answers the same whether or not the address was already there. */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { email?: unknown } | null;
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  if (email.length > 200 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return Response.json({ error: "That email address does not look right." }, { status: 400 });
  try {
    await (await getDb()).insert(waitlist).values({ email }).onConflictDoNothing();
    return Response.json({ ok: true }, { status: 201 });
  } catch (error) {
    if (!(error instanceof DatabaseNotConfigured)) console.error("waitlist failed", error);
    return Response.json({ error: "We could not save that right now. Please try again later." }, { status: 503 });
  }
}
