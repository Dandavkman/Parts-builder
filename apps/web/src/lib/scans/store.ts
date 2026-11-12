import { and, eq } from "drizzle-orm";
import type { Db } from "../db/client";
import { designs, userScans } from "../db/schema";

export async function createScan(db: Db, ownerId: string, filename: string, sizeBytes: number, storageKey: (scanId: string) => string): Promise<string> {
  const [row] = await db.insert(userScans).values({ ownerId, filename: filename.slice(0, 200), sizeBytes, storageKey: "" }).returning({ id: userScans.id });
  await db.update(userScans).set({ storageKey: storageKey(row.id) }).where(eq(userScans.id, row.id));
  return row.id;
}

export async function getOwnedScan(db: Db, scanId: string, ownerId: string) {
  const [row] = await db.select().from(userScans).where(and(eq(userScans.id, scanId), eq(userScans.ownerId, ownerId)));
  return row ?? null;
}

export async function markUploaded(db: Db, scanId: string, ownerId: string): Promise<boolean> {
  const rows = await db.update(userScans).set({ status: "uploaded" }).where(and(eq(userScans.id, scanId), eq(userScans.ownerId, ownerId))).returning({ id: userScans.id });
  return rows.length > 0;
}

/** Attaches an uploaded scan to a design. Both must belong to the owner. */
export async function attachScan(db: Db, designId: string, scanId: string, ownerId: string): Promise<boolean> {
  const scan = await getOwnedScan(db, scanId, ownerId);
  if (!scan || scan.status !== "uploaded") return false;
  const rows = await db.update(designs).set({ scanId }).where(and(eq(designs.id, designId), eq(designs.ownerId, ownerId))).returning({ id: designs.id });
  return rows.length > 0;
}

/** The scan attached to a design, for the agent and the page. Never the file itself. */
export async function scanForDesign(db: Db, designId: string) {
  const [row] = await db
    .select({ id: userScans.id, filename: userScans.filename, sizeBytes: userScans.sizeBytes, status: userScans.status })
    .from(designs)
    .innerJoin(userScans, eq(userScans.id, designs.scanId))
    .where(eq(designs.id, designId));
  return row ?? null;
}
