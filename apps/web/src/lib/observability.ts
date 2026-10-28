/**
 * Error tracking. Always logs to the console; also sends to Sentry when `SENTRY_DSN` is set, and does nothing
 * extra when it is not. It talks to Sentry's HTTP API directly, so there is no SDK to bundle. It never throws:
 * a broken tracker must not break a request.
 */

export interface SentryTarget {
  url: string;
  authHeader: string;
}

/** Turns a DSN (`https://<key>@<host>/<project>`) into the store URL and auth header, or null if it is malformed. */
export function parseDsn(dsn: string | undefined): SentryTarget | null {
  if (!dsn) return null;
  try {
    const u = new URL(dsn);
    const projectId = u.pathname.replace(/^\/+/, "");
    if (!u.username || !projectId || !/^https?:$/.test(u.protocol)) return null;
    return {
      url: `${u.protocol}//${u.host}/api/${projectId}/store/`,
      authHeader: `Sentry sentry_version=7, sentry_client=parts-builder/1, sentry_key=${u.username}`,
    };
  } catch {
    return null;
  }
}

const MAX_TEXT = 2000;

/** The event body. Only the error's name, message and stack plus short context; never request bodies or headers. */
export function buildEvent(message: string, error: unknown, context: Record<string, string> = {}, now = new Date()) {
  const err = error instanceof Error ? error : new Error(typeof error === "string" ? error : "non-error thrown");
  return {
    message: message.slice(0, 200),
    level: "error",
    platform: "node",
    timestamp: now.toISOString(),
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "development",
    tags: context,
    exception: { values: [{ type: err.name, value: err.message.slice(0, MAX_TEXT), stacktrace: undefined }] },
    extra: { stack: err.stack?.slice(0, MAX_TEXT) },
  };
}

export async function reportError(
  message: string,
  error: unknown,
  context: Record<string, string> = {},
  env: Record<string, string | undefined> = process.env,
  send: typeof fetch = fetch,
): Promise<void> {
  console.error(message, error);
  const target = parseDsn(env.SENTRY_DSN);
  if (!target) return;
  try {
    await send(target.url, {
      method: "POST",
      headers: { "content-type": "application/json", "x-sentry-auth": target.authHeader },
      body: JSON.stringify(buildEvent(message, error, context)),
      signal: AbortSignal.timeout(3000),
    });
  } catch {
    // The tracker being down is not worth failing the request for.
  }
}
