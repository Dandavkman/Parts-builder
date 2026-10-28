import { and, asc, desc, eq, inArray } from "drizzle-orm";
import type { Db } from "../db/client";
import { listings, stores, takedownClaims } from "../db/schema";
import { validEmail } from "../email/mailer";

export type Claim = typeof takedownClaims.$inferSelect;
type Result<T = Claim> = { ok: true; claim: T } | { ok: false; error: string; status: number };

const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/**
 * Files an intellectual-property claim against a listing. Public, so it only checks that the claim is
 * complete; an admin decides. The claimant must state in good faith that they own or represent the rights.
 */
export async function fileClaim(
  db: Db,
  input: { listingId: unknown; name: unknown; email: unknown; description: unknown; goodFaith: unknown },
): Promise<Result> {
  const name = text(input.name, 100);
  const description = text(input.description, 2000);
  if (typeof input.listingId !== "string" || !/^[0-9a-f-]{36}$/i.test(input.listingId)) return { ok: false, error: "Tell us which listing the claim is about.", status: 400 };
  if (!name) return { ok: false, error: "Your name is required.", status: 400 };
  if (!validEmail(input.email)) return { ok: false, error: "A valid email address is required.", status: 400 };
  if (description.length < 20) return { ok: false, error: "Describe the work you own and why this listing infringes it (at least 20 characters).", status: 400 };
  if (input.goodFaith !== true) return { ok: false, error: "You must confirm the claim is made in good faith.", status: 400 };
  const [listing] = await db.select({ id: listings.id }).from(listings).where(eq(listings.id, input.listingId));
  if (!listing) return { ok: false, error: "Listing not found.", status: 404 };
  const [claim] = await db
    .insert(takedownClaims)
    .values({ listingId: listing.id, claimantName: name, claimantEmail: (input.email as string).trim(), workDescription: description })
    .returning();
  return { ok: true, claim };
}

export interface ClaimRow {
  claim: Claim;
  listingTitle: string;
  storeName: string;
  storeSlug: string;
}

/** Claims an admin has to act on: new ones, and removals the seller has disputed. Oldest first. */
export async function claimQueue(db: Db): Promise<ClaimRow[]> {
  return db
    .select({ claim: takedownClaims, listingTitle: listings.title, storeName: stores.name, storeSlug: stores.slug })
    .from(takedownClaims)
    .innerJoin(listings, eq(listings.id, takedownClaims.listingId))
    .innerJoin(stores, eq(stores.id, listings.storeId))
    .where(inArray(takedownClaims.status, ["open", "counter_filed"]))
    .orderBy(asc(takedownClaims.createdAt));
}

/**
 * An admin's first decision on an open claim. "remove" takes the listing down at once (temporary removal,
 * remembering what it was) and the seller sees a notice; "dismiss" leaves the listing as it is.
 */
export async function decideClaim(db: Db, input: { claimId: string; adminId: string; decision: unknown; note?: unknown }): Promise<Result> {
  const [row] = await db.select().from(takedownClaims).where(eq(takedownClaims.id, input.claimId));
  if (!row) return { ok: false, error: "Claim not found.", status: 404 };
  if (row.status !== "open") return { ok: false, error: `This claim is already ${row.status}.`, status: 409 };
  if (input.decision !== "remove" && input.decision !== "dismiss") return { ok: false, error: "decision must be remove or dismiss.", status: 400 };
  const note = text(input.note, 500);
  if (!note) return { ok: false, error: "Write a short reason; the seller will see it.", status: 400 };
  // The database driver has no transactions, so the claim is updated first, conditionally: the one who wins
  // that update is the only one who goes on to change the listing.
  let previous: string | null = null;
  if (input.decision === "remove") {
    const [listing] = await db.select().from(listings).where(eq(listings.id, row.listingId));
    previous = listing.reviewStatus;
  }
  const [claim] = await db
    .update(takedownClaims)
    .set({ status: input.decision === "remove" ? "removed" : "dismissed", previousListingStatus: previous, decisionNote: note, decidedBy: input.adminId, decidedAt: new Date() })
    .where(and(eq(takedownClaims.id, input.claimId), eq(takedownClaims.status, "open")))
    .returning();
  if (!claim) return { ok: false, error: "This claim was just decided by someone else.", status: 409 };
  if (input.decision === "remove") await db.update(listings).set({ reviewStatus: "removed" }).where(eq(listings.id, row.listingId));
  return { ok: true, claim };
}

/** Claims against the signed-in seller's listings, newest first: their notices. The claimant's email is not included. */
export async function claimsForSeller(db: Db, ownerId: string) {
  return db
    .select({
      id: takedownClaims.id,
      status: takedownClaims.status,
      listingTitle: listings.title,
      workDescription: takedownClaims.workDescription,
      decisionNote: takedownClaims.decisionNote,
      counterText: takedownClaims.counterText,
      createdAt: takedownClaims.createdAt,
    })
    .from(takedownClaims)
    .innerJoin(listings, eq(listings.id, takedownClaims.listingId))
    .innerJoin(stores, eq(stores.id, listings.storeId))
    .where(eq(stores.ownerId, ownerId))
    .orderBy(desc(takedownClaims.createdAt));
}

/** The seller disputes a removal. Only the store's owner can, and only while the listing is down. */
export async function fileCounter(db: Db, input: { ownerId: string; claimId: string; text: unknown }): Promise<Result> {
  const [row] = await db
    .select({ claim: takedownClaims })
    .from(takedownClaims)
    .innerJoin(listings, eq(listings.id, takedownClaims.listingId))
    .innerJoin(stores, eq(stores.id, listings.storeId))
    .where(and(eq(takedownClaims.id, input.claimId), eq(stores.ownerId, input.ownerId)));
  if (!row) return { ok: false, error: "Claim not found.", status: 404 };
  if (row.claim.status !== "removed") return { ok: false, error: "Only a removed listing can be disputed.", status: 409 };
  const counter = text(input.text, 2000);
  if (counter.length < 20) return { ok: false, error: "Explain why the listing does not infringe (at least 20 characters).", status: 400 };
  const [claim] = await db
    .update(takedownClaims)
    .set({ status: "counter_filed", counterText: counter, counterFiledAt: new Date() })
    .where(and(eq(takedownClaims.id, input.claimId), eq(takedownClaims.status, "removed")))
    .returning();
  return claim ? { ok: true, claim } : { ok: false, error: "This claim just changed. Reload and try again.", status: 409 };
}

/** An admin's decision after a counter-notice: put the listing back ("restore") or keep it down ("uphold"). */
export async function decideCounter(db: Db, input: { claimId: string; adminId: string; decision: unknown; note?: unknown }): Promise<Result> {
  const [row] = await db.select().from(takedownClaims).where(eq(takedownClaims.id, input.claimId));
  if (!row) return { ok: false, error: "Claim not found.", status: 404 };
  if (row.status !== "counter_filed") return { ok: false, error: "There is no counter-notice to decide.", status: 409 };
  if (input.decision !== "restore" && input.decision !== "uphold") return { ok: false, error: "decision must be restore or uphold.", status: 400 };
  const note = text(input.note, 500);
  if (!note) return { ok: false, error: "Write a short reason.", status: 400 };
  const [claim] = await db
    .update(takedownClaims)
    .set({ status: input.decision === "restore" ? "restored" : "upheld", decisionNote: note, decidedBy: input.adminId, decidedAt: new Date() })
    .where(and(eq(takedownClaims.id, input.claimId), eq(takedownClaims.status, "counter_filed")))
    .returning();
  if (!claim) return { ok: false, error: "This claim was just decided by someone else.", status: 409 };
  if (input.decision === "restore") await db.update(listings).set({ reviewStatus: row.previousListingStatus ?? "pending" }).where(eq(listings.id, row.listingId));
  return { ok: true, claim };
}
