import { and, asc, desc, eq } from "drizzle-orm";
import type { Db } from "../db/client";
import { designs, feedback } from "../db/schema";
import { dispatchFeedback, type DispatchEnv, dispatchEnv } from "./dispatch";

export type FeedbackRow = typeof feedback.$inferSelect;
type Result<T = FeedbackRow> = { ok: true; feedback: T } | { ok: false; error: string; status: number };

import { FEEDBACK_MAX, FEEDBACK_MIN } from "./limits";

/** A tester's comment about the design they are on. Only the design's owner can attach feedback to it. */
export async function submitFeedback(db: Db, input: { ownerId: string; designId: string; body: unknown }): Promise<Result> {
  const body = typeof input.body === "string" ? input.body.trim() : "";
  if (body.length < FEEDBACK_MIN) return { ok: false, error: `Tell us a little more (at least ${FEEDBACK_MIN} characters).`, status: 400 };
  if (body.length > FEEDBACK_MAX) return { ok: false, error: `Please keep feedback under ${FEEDBACK_MAX} characters.`, status: 400 };
  const [design] = await db.select({ id: designs.id }).from(designs).where(and(eq(designs.id, input.designId), eq(designs.ownerId, input.ownerId)));
  if (!design) return { ok: false, error: "Design not found.", status: 404 };
  const [row] = await db.insert(feedback).values({ ownerId: input.ownerId, designId: design.id, body }).returning();
  return { ok: true, feedback: row };
}

/** What a tester sees about their own comments on a design. No admin notes or issue addresses. */
export async function feedbackForOwner(db: Db, ownerId: string, designId: string) {
  const rows = await db
    .select({ id: feedback.id, body: feedback.body, status: feedback.status, createdAt: feedback.createdAt })
    .from(feedback)
    .where(and(eq(feedback.ownerId, ownerId), eq(feedback.designId, designId)))
    .orderBy(desc(feedback.createdAt));
  return rows;
}

/** The admin queue: new comments first (oldest first), or every comment of one status. */
export async function feedbackQueue(db: Db, status: string = "new"): Promise<FeedbackRow[]> {
  return db
    .select()
    .from(feedback)
    .where(eq(feedback.status, status))
    .orderBy(status === "new" ? asc(feedback.createdAt) : desc(feedback.createdAt));
}

/**
 * An admin's decision. "reject" closes it. "approve" hands it to the coding agent (a GitHub issue) and records
 * the issue address, or why that did not happen. An approved comment with no issue yet can be approved again to retry.
 */
export async function decideFeedback(
  db: Db,
  input: { id: string; adminId: string; decision: unknown; note?: unknown },
  env: DispatchEnv = dispatchEnv(),
  doFetch: typeof fetch = fetch,
): Promise<Result> {
  const [row] = await db.select().from(feedback).where(eq(feedback.id, input.id));
  if (!row) return { ok: false, error: "Feedback not found.", status: 404 };
  const note = typeof input.note === "string" ? input.note.trim().slice(0, 500) || null : null;
  if (input.decision !== "approve" && input.decision !== "reject") return { ok: false, error: "Decision must be approve or reject.", status: 400 };
  const retry = row.status === "approved" && !row.issueUrl && input.decision === "approve";
  if (row.status !== "new" && !retry) return { ok: false, error: `This feedback is already ${row.status}.`, status: 409 };
  if (input.decision === "reject") {
    const [updated] = await db.update(feedback).set({ status: "rejected", adminNote: note, decidedBy: input.adminId, decidedAt: new Date() }).where(eq(feedback.id, row.id)).returning();
    return { ok: true, feedback: updated };
  }
  const sent = await dispatchFeedback({ feedbackId: row.id, designId: row.designId, body: row.body }, env, doFetch);
  const [updated] = await db
    .update(feedback)
    .set({
      status: "approved",
      adminNote: note ?? row.adminNote,
      decidedBy: input.adminId,
      decidedAt: row.decidedAt ?? new Date(),
      issueUrl: sent.ok ? sent.issueUrl : null,
      dispatchError: sent.ok ? null : sent.error,
    })
    .where(eq(feedback.id, row.id))
    .returning();
  return { ok: true, feedback: updated };
}
