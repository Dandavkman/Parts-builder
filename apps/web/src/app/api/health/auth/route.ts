import { checkClerkKeys } from "../../../../lib/auth-check";
import { getAuthMode } from "../../../../lib/auth-mode";

export const dynamic = "force-dynamic";

/** Public on purpose: answers only yes/no about the Clerk keys and whether Clerk's server accepts the secret key. Never returns a key. */
export async function GET() {
  const keys = checkClerkKeys();
  let clerkApi: { ok: boolean; status?: number; ms?: number; error?: string } = { ok: false, error: "not tried" };
  if (getAuthMode() === "clerk" && keys.secret.clean) {
    const started = Date.now();
    try {
      const response = await fetch("https://api.clerk.com/v1/jwks", {
        headers: { Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}` },
        signal: AbortSignal.timeout(8000),
      });
      clerkApi = { ok: response.ok, status: response.status, ms: Date.now() - started };
    } catch (error) {
      clerkApi = { ok: false, ms: Date.now() - started, error: error instanceof Error ? error.name : "failed" };
    }
  } else if (!keys.secret.clean) {
    clerkApi = { ok: false, error: "secret key is not plain ASCII, so it was not sent" };
  }
  const ok = keys.problems.length === 0 && clerkApi.ok;
  return Response.json({ ok, mode: getAuthMode(), keys, clerkApi }, { status: ok ? 200 : 503 });
}
