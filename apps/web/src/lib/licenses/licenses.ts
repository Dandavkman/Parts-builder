import { and, eq } from "drizzle-orm";
import type { Db } from "../db/client";
import { scanLicenses } from "../db/schema";
import { getPlan } from "../plans-store";
import { getVehicle, SCAN_AREAS, type ScanArea } from "../vehicles/catalog";

export type LicenseSource = "purchase" | "pro" | "admin";
export type License = typeof scanLicenses.$inferSelect;

export type GrantResult = { ok: true; license: License; duplicate: boolean } | { ok: false; error: string; status: number };

const isArea = (v: unknown): v is ScanArea => typeof v === "string" && (SCAN_AREAS as readonly string[]).includes(v);

/**
 * Gives a user the right to use one scanned area of a car in the workspace. Only areas that have a scan can
 * be licensed. Granting twice returns the first license. A license is the right to design against the scan;
 * it never gives access to the scan file, which stays on the server (plan rule 2).
 */
export async function grantLicense(
  db: Db,
  input: { ownerId: string; vehicleId: unknown; area: unknown; source: LicenseSource; ref?: string },
): Promise<GrantResult> {
  const vehicle = typeof input.vehicleId === "string" ? getVehicle(input.vehicleId) : undefined;
  if (!vehicle) return { ok: false, error: "Car not found.", status: 404 };
  if (!isArea(input.area)) return { ok: false, error: "Unknown area.", status: 400 };
  if (!vehicle.scanned.includes(input.area)) return { ok: false, error: "That area has not been scanned yet.", status: 409 };
  const key = { ownerId: input.ownerId, vehicleId: vehicle.id, area: input.area };
  const [created] = await db
    .insert(scanLicenses)
    .values({ ...key, source: input.source, ref: input.ref ?? null })
    .onConflictDoNothing()
    .returning();
  if (created) return { ok: true, license: created, duplicate: false };
  const [existing] = await db
    .select()
    .from(scanLicenses)
    .where(and(eq(scanLicenses.ownerId, key.ownerId), eq(scanLicenses.vehicleId, key.vehicleId), eq(scanLicenses.area, key.area)));
  return { ok: true, license: existing, duplicate: true };
}

/** Whether the user may use this area: they hold a license for it, or they are on Pro, which includes every scanned area. */
export async function canUseScan(db: Db, ownerId: string, vehicleId: string, area: ScanArea): Promise<boolean> {
  const vehicle = getVehicle(vehicleId);
  if (!vehicle?.scanned.includes(area)) return false;
  const [held] = await db
    .select({ id: scanLicenses.id })
    .from(scanLicenses)
    .where(and(eq(scanLicenses.ownerId, ownerId), eq(scanLicenses.vehicleId, vehicleId), eq(scanLicenses.area, area)));
  if (held) return true;
  return (await getPlan(db, ownerId)) === "pro";
}

/** For each scanned area of a car: whether this user may use it, and how (a license or the Pro plan). */
export async function accessFor(db: Db, ownerId: string, vehicleId: string): Promise<{ area: ScanArea; allowed: boolean; via: "license" | "pro" | null }[] | null> {
  const vehicle = getVehicle(vehicleId);
  if (!vehicle) return null;
  const held = new Set((await db.select({ area: scanLicenses.area }).from(scanLicenses).where(and(eq(scanLicenses.ownerId, ownerId), eq(scanLicenses.vehicleId, vehicleId)))).map((r) => r.area));
  const pro = (await getPlan(db, ownerId)) === "pro";
  return vehicle.scanned.map((area) => {
    const via = held.has(area) ? "license" : pro ? "pro" : null;
    return { area, allowed: via !== null, via };
  });
}
