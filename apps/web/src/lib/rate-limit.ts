import { and, lt, sql } from "drizzle-orm";
import type { Db } from "./db/client";
import { rateLimits } from "./db/schema";

export interface Limit {
  /** Which action is limited, for example "waitlist". */
  name: string;
  max: number;
  windowSeconds: number;
}

export const LIMITS = {
  waitlist: { name: "waitlist", max: 5, windowSeconds: 3600 },
  orders: { name: "orders", max: 20, windowSeconds: 3600 },
} satisfies Record<string, Limit>;

export type RateResult = { ok: true } | { ok: false; retryAfterSeconds: number };

/** The caller's address from the proxy headers, or "unknown" (all unknown callers then share one bucket). */
export function clientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip") || "unknown";
}

/**
 * Counts one hit for `who` against `limit` in the current fixed window and says whether it is allowed.
 * The increment is a single atomic upsert, so requests arriving together are all counted.
 */
export async function hit(db: Db, limit: Limit, who: string, now = new Date()): Promise<RateResult> {
  const windowMs = limit.windowSeconds * 1000;
  const windowStart = new Date(Math.floor(now.getTime() / windowMs) * windowMs);
  const key = `${limit.name}:${who}`;
  const [row] = await db
    .insert(rateLimits)
    .values({ key, windowStart, hits: 1 })
    .onConflictDoUpdate({ target: [rateLimits.key, rateLimits.windowStart], set: { hits: sql`${rateLimits.hits} + 1` } })
    .returning({ hits: rateLimits.hits });
  if ((row?.hits ?? 1) <= limit.max) return { ok: true };
  return { ok: false, retryAfterSeconds: Math.max(1, Math.ceil((windowStart.getTime() + windowMs - now.getTime()) / 1000)) };
}

/** Deletes windows that ended more than a day ago. Cheap enough to run now and then. */
export async function pruneRateLimits(db: Db, now = new Date()): Promise<void> {
  await db.delete(rateLimits).where(and(lt(rateLimits.windowStart, new Date(now.getTime() - 86_400_000))));
}

export function tooMany(result: Extract<RateResult, { ok: false }>): Response {
  return Response.json(
    { error: "Too many requests. Please wait and try again." },
    { status: 429, headers: { "retry-after": String(result.retryAfterSeconds) } },
  );
}
