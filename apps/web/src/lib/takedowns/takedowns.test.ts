import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { createDesign, recorderFor } from "../agent/store";
import { runnerFor, type Db } from "../db/client";
import { migrate } from "../db/migrations";
import * as schema from "../db/schema";
import { buildQuotes } from "../quotes/engine";
import { saveQuotes } from "../quotes/store";
import { createListing, createStore } from "../stores/store";
import { claimQueue, claimsForSeller, decideClaim, decideCounter, fileClaim, fileCounter } from "./takedowns";

describe("takedowns", () => {
  let db: Db;
  beforeAll(async () => {
    db = drizzle(new PGlite(), { schema }) as unknown as Db;
    await migrate(runnerFor(db));
  });

  const spec = { spec_version: "1.1", features: [{ type: "plate", id: "a", thickness_mm: 3 }] };
  async function listing(owner: string, slug: string) {
    const store = await createStore(db, owner, "Shop", slug);
    if (!store.ok) throw new Error("store");
    const designId = await createDesign(db, owner, "Knob");
    await recorderFor(db, designId).version({ spec, ok: true, errors: [], createdBy: "agent", anchors: [] });
    const { quotes } = buildQuotes({ volume_mm3: 20_000, size_mm: [50, 40, 10], spec, quantity: 1 });
    const [quote] = await saveQuotes(db, designId, 1, quotes);
    const r = await createListing(db, { ownerId: owner, designId, quoteId: quote.id, retailCents: quote.totalCents + 500, title: "Knob" });
    if (!r.ok) throw new Error("listing");
    await db.update(schema.listings).set({ reviewStatus: "approved" }).where(eq(schema.listings.id, r.listing.id));
    return r.listing.id;
  }
  const good = { name: "Acme", email: "legal@acme.test", description: "We own the design of the Acme knob and this copies it.", goodFaith: true };
  const status = async (id: string) => (await db.select().from(schema.listings).where(eq(schema.listings.id, id)))[0].reviewStatus;

  it("checks a claim is complete before saving it", async () => {
    const id = await listing("t1", "take-a");
    expect(await fileClaim(db, { ...good, listingId: id, name: "" })).toMatchObject({ ok: false, status: 400 });
    expect(await fileClaim(db, { ...good, listingId: id, email: "nope" })).toMatchObject({ ok: false, status: 400 });
    expect(await fileClaim(db, { ...good, listingId: id, description: "too short" })).toMatchObject({ ok: false, status: 400 });
    expect(await fileClaim(db, { ...good, listingId: id, goodFaith: false })).toMatchObject({ ok: false, status: 400 });
    expect(await fileClaim(db, { ...good, listingId: "not-an-id" })).toMatchObject({ ok: false, status: 400 });
    expect(await fileClaim(db, { ...good, listingId: "00000000-0000-0000-0000-000000000000" })).toMatchObject({ ok: false, status: 404 });
    expect(await fileClaim(db, { ...good, listingId: id })).toMatchObject({ ok: true });
  });

  it("a removal takes the listing down, and the seller sees the notice (not the claimant's email)", async () => {
    const id = await listing("t2", "take-b");
    const filed = await fileClaim(db, { ...good, listingId: id });
    if (!filed.ok) throw new Error("claim");
    expect((await claimQueue(db)).map((c) => c.claim.id)).toContain(filed.claim.id);
    expect(await decideClaim(db, { claimId: filed.claim.id, adminId: "admin", decision: "remove" })).toMatchObject({ ok: false, status: 400 });
    expect(await decideClaim(db, { claimId: filed.claim.id, adminId: "admin", decision: "maybe", note: "x" })).toMatchObject({ ok: false, status: 400 });
    const removed = await decideClaim(db, { claimId: filed.claim.id, adminId: "admin", decision: "remove", note: "Looks like a copy." });
    expect(removed).toMatchObject({ ok: true, claim: { status: "removed", previousListingStatus: "approved" } });
    expect(await status(id)).toBe("removed");
    expect(await decideClaim(db, { claimId: filed.claim.id, adminId: "admin", decision: "dismiss", note: "again" })).toMatchObject({ ok: false, status: 409 });
    const notices = await claimsForSeller(db, "t2");
    expect(notices).toHaveLength(1);
    expect(notices[0]).toMatchObject({ status: "removed", decisionNote: "Looks like a copy." });
    expect(JSON.stringify(notices)).not.toContain("legal@acme.test");
    expect(await claimsForSeller(db, "someone-else")).toEqual([]);
  });

  it("a dismissed claim leaves the listing up", async () => {
    const id = await listing("t3", "take-c");
    const filed = await fileClaim(db, { ...good, listingId: id });
    if (!filed.ok) throw new Error("claim");
    expect(await decideClaim(db, { claimId: filed.claim.id, adminId: "admin", decision: "dismiss", note: "No overlap." })).toMatchObject({ ok: true, claim: { status: "dismissed" } });
    expect(await status(id)).toBe("approved");
  });

  it("the seller can dispute a removal, and an admin restores or upholds", async () => {
    const id = await listing("t4", "take-d");
    const filed = await fileClaim(db, { ...good, listingId: id });
    if (!filed.ok) throw new Error("claim");
    const claimId = filed.claim.id;
    expect(await fileCounter(db, { ownerId: "t4", claimId, text: "I made this myself from scratch." })).toMatchObject({ ok: false, status: 409 });
    await decideClaim(db, { claimId, adminId: "admin", decision: "remove", note: "Removed pending your reply." });
    expect(await fileCounter(db, { ownerId: "intruder", claimId, text: "I made this myself from scratch." })).toMatchObject({ ok: false, status: 404 });
    expect(await fileCounter(db, { ownerId: "t4", claimId, text: "short" })).toMatchObject({ ok: false, status: 400 });
    expect(await fileCounter(db, { ownerId: "t4", claimId, text: "I made this myself from scratch." })).toMatchObject({ ok: true, claim: { status: "counter_filed" } });
    expect((await claimQueue(db)).some((c) => c.claim.id === claimId)).toBe(true);
    expect(await decideCounter(db, { claimId, adminId: "admin", decision: "restore" })).toMatchObject({ ok: false, status: 400 });
    expect(await decideCounter(db, { claimId, adminId: "admin", decision: "restore", note: "Claimant gave no proof." })).toMatchObject({ ok: true, claim: { status: "restored" } });
    expect(await status(id)).toBe("approved");
  });

  it("upholding keeps the listing down", async () => {
    const id = await listing("t5", "take-e");
    const filed = await fileClaim(db, { ...good, listingId: id });
    if (!filed.ok) throw new Error("claim");
    const claimId = filed.claim.id;
    await decideClaim(db, { claimId, adminId: "admin", decision: "remove", note: "Removed." });
    await fileCounter(db, { ownerId: "t5", claimId, text: "I made this myself from scratch." });
    expect(await decideCounter(db, { claimId, adminId: "admin", decision: "uphold", note: "Proof is clear." })).toMatchObject({ ok: true, claim: { status: "upheld" } });
    expect(await status(id)).toBe("removed");
    expect(await decideCounter(db, { claimId, adminId: "admin", decision: "restore", note: "x" })).toMatchObject({ ok: false, status: 409 });
  });
});
