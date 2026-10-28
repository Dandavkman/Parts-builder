/**
 * Plans and limits (task B2.1a). The numbers are PLACEHOLDERS until the Owner decides the Pro plan's
 * price and limits (O2.3). Limits are only enforced when PLANS_ENFORCED=1, so nobody is blocked while
 * the numbers are still stand-ins. Checking out a Pro subscription through Stripe Billing comes later;
 * for now an admin sets a user's plan.
 */
export type Plan = "free" | "pro";
export const PLANS: Plan[] = ["free", "pro"];

export interface PlanLimits {
  aiMessagesPerMonth: number;
  savedDesigns: number;
  stepExport: boolean;
}

export const PLAN_LIMITS: Record<Plan, PlanLimits> = {
  free: { aiMessagesPerMonth: 30, savedDesigns: 5, stepExport: false },
  pro: { aiMessagesPerMonth: 500, savedDesigns: 200, stepExport: true },
};

type Env = Record<string, string | undefined>;

export const plansEnforced = (env: Env = process.env) => env.PLANS_ENFORCED === "1";

export function isPlan(value: unknown): value is Plan {
  return value === "free" || value === "pro";
}

export type LimitCheck = { ok: true } | { ok: false; error: string; upgrade: true };

const stop = (error: string): LimitCheck => ({ ok: false, error, upgrade: true });

export function checkAiMessage(plan: Plan, usedThisMonth: number): LimitCheck {
  const limit = PLAN_LIMITS[plan].aiMessagesPerMonth;
  return usedThisMonth >= limit ? stop(`You have used all ${limit} AI messages for this month on the ${plan} plan. Upgrade to Pro for more.`) : { ok: true };
}

export function checkNewDesign(plan: Plan, designCount: number): LimitCheck {
  const limit = PLAN_LIMITS[plan].savedDesigns;
  return designCount >= limit ? stop(`The ${plan} plan keeps up to ${limit} designs. Upgrade to Pro for more.`) : { ok: true };
}

export function checkStepExport(plan: Plan): LimitCheck {
  return PLAN_LIMITS[plan].stepExport ? { ok: true } : stop("STEP export is part of the Pro plan. STL and the 3D preview are free.");
}

/** "2026-10" for a date, in UTC. Usage counters reset each calendar month. */
export function periodOf(date: Date = new Date()): string {
  return date.toISOString().slice(0, 7);
}
