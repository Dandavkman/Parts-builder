import { and, desc, eq, inArray } from "drizzle-orm";
import type { Db } from "../db/client";
import { designs, designVehicleTags } from "../db/schema";
import { canUseScan } from "../licenses/licenses";
import { coveredVehicles, getVehicle, SCAN_AREAS, type ScanArea } from "./catalog";

export type TagResult = { ok: true; vehicleIds: string[] } | { ok: false; error: string; status: number };

const isArea = (v: unknown): v is ScanArea => typeof v === "string" && (SCAN_AREAS as readonly string[]).includes(v);

/**
 * Tags a design with every car the scan it was made on covers. Only the design's owner can tag it, and only
 * from a scan they may use. Tagging again with the same scan changes nothing; a design made on a different
 * scan adds that scan's cars.
 */
export async function tagDesign(db: Db, ownerId: string, designId: string, vehicleId: unknown, area: unknown): Promise<TagResult> {
  const vehicle = typeof vehicleId === "string" ? getVehicle(vehicleId) : undefined;
  if (!vehicle) return { ok: false, error: "Car not found.", status: 404 };
  if (!isArea(area)) return { ok: false, error: "Unknown area.", status: 400 };
  const [design] = await db.select({ id: designs.id }).from(designs).where(and(eq(designs.id, designId), eq(designs.ownerId, ownerId)));
  if (!design) return { ok: false, error: "Design not found.", status: 404 };
  if (!(await canUseScan(db, ownerId, vehicle.id, area))) return { ok: false, error: "You do not have that scan.", status: 403 };
  const cars = coveredVehicles(vehicle.id);
  await db
    .insert(designVehicleTags)
    .values(cars.map((c) => ({ designId, vehicleId: c.id, area })))
    .onConflictDoNothing();
  return { ok: true, vehicleIds: cars.map((c) => c.id) };
}

/** The cars a design is tagged for (no owner check; used for listings and the design page). */
export async function tagsFor(db: Db, designId: string): Promise<string[]> {
  const rows = await db.select({ vehicleId: designVehicleTags.vehicleId }).from(designVehicleTags).where(eq(designVehicleTags.designId, designId));
  return rows.map((r) => r.vehicleId).sort();
}

/** The owner's designs tagged for a car, newest first. */
export async function ownedDesignsForVehicle(db: Db, ownerId: string, vehicleId: string) {
  const tagged = db.select({ id: designVehicleTags.designId }).from(designVehicleTags).where(eq(designVehicleTags.vehicleId, vehicleId));
  return db
    .select({ id: designs.id, title: designs.title, currentVersion: designs.currentVersion, createdAt: designs.createdAt })
    .from(designs)
    .where(and(eq(designs.ownerId, ownerId), inArray(designs.id, tagged)))
    .orderBy(desc(designs.createdAt))
    .limit(50);
}
