import { and, eq, gte, sql } from "drizzle-orm";
import type { Db } from "./db/client";
import { chatMessages, designs } from "./db/schema";

/**
 * AI cost tracking (task B2.11a). Token counts are stored with every model message; this turns them into
 * dollars with a price table. The prices below are ESTIMATES in US dollars per million tokens, entered
 * from memory of published list prices and NOT checked: the Owner should confirm them against the
 * Anthropic pricing page and edit this table. Web searches are not included (about 1 cent each).
 */
export interface ModelPrice {
  inputPerMTok: number;
  outputPerMTok: number;
  cacheWritePerMTok: number;
  cacheReadPerMTok: number;
}

export const PRICES_ARE_ESTIMATES = true;

export const MODEL_PRICES: Record<string, ModelPrice> = {
  "claude-sonnet-5-5": { inputPerMTok: 3, outputPerMTok: 15, cacheWritePerMTok: 3.75, cacheReadPerMTok: 0.3 },
  "claude-haiku-5-5": { inputPerMTok: 1, outputPerMTok: 5, cacheWritePerMTok: 1.25, cacheReadPerMTok: 0.1 },
};
/** Used for a model not in the table, so cost is never silently zero. */
export const FALLBACK_PRICE: ModelPrice = MODEL_PRICES["claude-sonnet-5-5"];

export interface TokenCounts {
  input: number;
  output: number;
  cacheWrite: number;
  cacheRead: number;
}

export function costUsd(model: string | null, t: TokenCounts): number {
  const p = (model && MODEL_PRICES[model]) || FALLBACK_PRICE;
  return (t.input * p.inputPerMTok + t.output * p.outputPerMTok + t.cacheWrite * p.cacheWritePerMTok + t.cacheRead * p.cacheReadPerMTok) / 1_000_000;
}

export interface DesignCost {
  designId: string;
  title: string;
  ownerId: string;
  messages: number;
  costUsd: number;
}

export interface CostReport {
  since: Date;
  totalUsd: number;
  byDesign: DesignCost[];
  byUser: { ownerId: string; costUsd: number; designs: number }[];
  estimates: boolean;
}

/** Spend since a date, per design (most expensive first) and per user. */
export async function costReport(db: Db, since: Date, top = 20): Promise<CostReport> {
  const rows = await db
    .select({
      designId: chatMessages.designId,
      title: designs.title,
      ownerId: designs.ownerId,
      model: chatMessages.model,
      messages: sql<number>`count(*)::int`,
      input: sql<number>`coalesce(sum(${chatMessages.inputTokens}), 0)::float8`,
      output: sql<number>`coalesce(sum(${chatMessages.outputTokens}), 0)::float8`,
      cacheWrite: sql<number>`coalesce(sum(${chatMessages.cacheCreationInputTokens}), 0)::float8`,
      cacheRead: sql<number>`coalesce(sum(${chatMessages.cacheReadInputTokens}), 0)::float8`,
    })
    .from(chatMessages)
    .innerJoin(designs, eq(designs.id, chatMessages.designId))
    .where(and(gte(chatMessages.createdAt, since), eq(chatMessages.role, "assistant")))
    .groupBy(chatMessages.designId, designs.title, designs.ownerId, chatMessages.model);

  const byDesign = new Map<string, DesignCost>();
  for (const r of rows) {
    const cost = costUsd(r.model, { input: r.input, output: r.output, cacheWrite: r.cacheWrite, cacheRead: r.cacheRead });
    const d = byDesign.get(r.designId) ?? { designId: r.designId, title: r.title, ownerId: r.ownerId, messages: 0, costUsd: 0 };
    d.messages += Number(r.messages);
    d.costUsd += cost;
    byDesign.set(r.designId, d);
  }
  const all = [...byDesign.values()].sort((a, b) => b.costUsd - a.costUsd);
  const users = new Map<string, { ownerId: string; costUsd: number; designs: number }>();
  for (const d of all) {
    const u = users.get(d.ownerId) ?? { ownerId: d.ownerId, costUsd: 0, designs: 0 };
    u.costUsd += d.costUsd;
    u.designs += 1;
    users.set(d.ownerId, u);
  }
  return {
    since,
    totalUsd: all.reduce((sum, d) => sum + d.costUsd, 0),
    byDesign: all.slice(0, top),
    byUser: [...users.values()].sort((a, b) => b.costUsd - a.costUsd).slice(0, top),
    estimates: PRICES_ARE_ESTIMATES,
  };
}

/** How many messages this user sent to the agent since `since`, across all their designs. Used for the rate limit. */
export async function recentUserMessages(db: Db, ownerId: string, since: Date): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(chatMessages)
    .innerJoin(designs, eq(designs.id, chatMessages.designId))
    .where(and(eq(designs.ownerId, ownerId), eq(chatMessages.role, "user"), gte(chatMessages.createdAt, since)));
  return Number(row?.n ?? 0);
}

/** At most this many messages to the agent per user per minute. Stops a script from running up the model bill. */
export const MESSAGES_PER_MINUTE = 10;

