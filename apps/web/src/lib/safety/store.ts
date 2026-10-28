import { and, desc, eq, isNull } from "drizzle-orm";
import type { Db } from "../db/client";
import { designs, safetyReviews } from "../db/schema";
import { SAFETY_STATUSES, stricter, type SafetyStatus, type Verdict } from "./classifier";

export type SafetyReview = typeof safetyReviews.$inferSelect;

/**
 * Records a verdict for a design and raises the design's status if the verdict is stricter. A design is
 * never made less strict here. Returns the status the design now has.
 */
export async function applyVerdict(db: Db, designId: string, source: "request" | "spec", verdict: Verdict, model?: string): Promise<SafetyStatus> {
  await db.insert(safetyReviews).values({ designId, source, status: verdict.status, category: verdict.category, reason: verdict.reason, model: model ?? null });
  const [design] = await db.select({ status: designs.safetyStatus }).from(designs).where(eq(designs.id, designId));
  const current = SAFETY_STATUSES.includes(design?.status as SafetyStatus) ? (design!.status as SafetyStatus) : "allowed";
  const next = stricter(current, verdict.status);
  if (next !== current) await db.update(designs).set({ safetyStatus: next }).where(eq(designs.id, designId));
  return next;
}

/** Reviews that flagged a design and have no admin decision yet, oldest first. */
export async function pendingReviews(db: Db): Promise<SafetyReview[]> {
  const rows = await db
    .select()
    .from(safetyReviews)
    .where(and(isNull(safetyReviews.decision), eq(safetyReviews.status, "needs_review")))
    .orderBy(safetyReviews.createdAt)
    .limit(200);
  return rows;
}

export type DecideResult = { ok: true; status: SafetyStatus } | { ok: false; reason: "not_found" | "not_pending" };

/**
 * An admin approves (design becomes allowed) or rejects (design becomes blocked) a design that is
 * waiting for review. Every open review of that design is closed with the decision.
 */
export async function decideReview(db: Db, designId: string, decision: "approved" | "rejected", adminId: string, now: Date = new Date()): Promise<DecideResult> {
  const [design] = await db.select().from(designs).where(eq(designs.id, designId));
  if (!design) return { ok: false, reason: "not_found" };
  if (design.safetyStatus !== "needs_review") return { ok: false, reason: "not_pending" };
  const status: SafetyStatus = decision === "approved" ? "allowed" : "blocked";
  await db.update(designs).set({ safetyStatus: status }).where(eq(designs.id, designId));
  await db
    .update(safetyReviews)
    .set({ decision, decidedBy: adminId, decidedAt: now })
    .where(and(eq(safetyReviews.designId, designId), isNull(safetyReviews.decision)));
  await db.insert(safetyReviews).values({ designId, source: "admin", status, category: "admin decision", reason: `Admin ${decision} the design.`, decidedBy: adminId, decision, decidedAt: now });
  return { ok: true, status };
}

export async function reviewsForDesign(db: Db, designId: string): Promise<SafetyReview[]> {
  return db.select().from(safetyReviews).where(eq(safetyReviews.designId, designId)).orderBy(desc(safetyReviews.createdAt));
}
