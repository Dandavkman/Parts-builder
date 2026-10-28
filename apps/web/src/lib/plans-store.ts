import { count, eq, sql } from "drizzle-orm";
import type { Db } from "./db/client";
import { designs, subscriptions, usageCounters } from "./db/schema";
import { isPlan, periodOf, type Plan } from "./plans";

export async function getPlan(db: Db, ownerId: string): Promise<Plan> {
  const [row] = await db.select({ plan: subscriptions.plan }).from(subscriptions).where(eq(subscriptions.ownerId, ownerId));
  return isPlan(row?.plan) ? row.plan : "free";
}

export async function setPlan(db: Db, ownerId: string, plan: Plan): Promise<void> {
  await db
    .insert(subscriptions)
    .values({ ownerId, plan })
    .onConflictDoUpdate({ target: subscriptions.ownerId, set: { plan, updatedAt: sql`now()` } });
}

export async function aiMessagesUsed(db: Db, ownerId: string, period = periodOf()): Promise<number> {
  const [row] = await db
    .select({ n: usageCounters.aiMessages })
    .from(usageCounters)
    .where(sql`${usageCounters.ownerId} = ${ownerId} AND ${usageCounters.period} = ${period}`);
  return row?.n ?? 0;
}

/** Counts one AI message against this month. Atomic, so two requests at once both count. */
export async function countAiMessage(db: Db, ownerId: string, period = periodOf()): Promise<void> {
  await db
    .insert(usageCounters)
    .values({ ownerId, period, aiMessages: 1 })
    .onConflictDoUpdate({ target: [usageCounters.ownerId, usageCounters.period], set: { aiMessages: sql`${usageCounters.aiMessages} + 1` } });
}

export async function designCount(db: Db, ownerId: string): Promise<number> {
  const [row] = await db.select({ n: count() }).from(designs).where(eq(designs.ownerId, ownerId));
  return Number(row?.n ?? 0);
}
