/**
 * Usage limits (task B2.1). There are no plans or paid tiers (decision D6): Ktiso earns a margin on orders.
 * One set of limits applies to everyone and exists only to stop abuse and runaway model cost. The numbers are
 * PLACEHOLDERS until the Owner decides them (O2.3). Limits are only enforced when LIMITS_ENFORCED=1.
 */
export interface Limits {
  aiMessagesPerMonth: number;
  savedDesigns: number;
}

export const LIMITS: Limits = { aiMessagesPerMonth: 500, savedDesigns: 200 };

type Env = Record<string, string | undefined>;

export const limitsEnforced = (env: Env = process.env) => env.LIMITS_ENFORCED === "1";

export type LimitCheck = { ok: true } | { ok: false; error: string };

const stop = (error: string): LimitCheck => ({ ok: false, error });

export function checkAiMessage(usedThisMonth: number, limits: Limits = LIMITS): LimitCheck {
  return usedThisMonth >= limits.aiMessagesPerMonth ? stop(`You have used all ${limits.aiMessagesPerMonth} AI messages for this month. The count resets on the first of the month (UTC).`) : { ok: true };
}

export function checkNewDesign(designCount: number, limits: Limits = LIMITS): LimitCheck {
  return designCount >= limits.savedDesigns ? stop(`You can keep up to ${limits.savedDesigns} designs. Delete one to start another.`) : { ok: true };
}

/** "2026-10" for a date, in UTC. Usage counters reset each calendar month. */
export function periodOf(date: Date = new Date()): string {
  return date.toISOString().slice(0, 7);
}
