import type { ScanArea, Vehicle } from "./catalog";

export const AREA_LABELS: Record<ScanArea, string> = {
  dash: "Dashboard",
  "center-console": "Center console",
  "door-card": "Door cards",
  "engine-bay": "Engine bay",
  trunk: "Trunk",
  underbody: "Underbody",
};

/** PLACEHOLDER price of one library scan area until the Owner decides library pricing (O3.1). */
export const SCAN_AREA_PRICE_CENTS = 1500;
export const LIBRARY_PRICES_ARE_PLACEHOLDER = true;

export interface AreaOffer {
  area: ScanArea;
  label: string;
  /** A scan exists for this area. Areas without one are listed as "coming" so people can see what is planned. */
  available: boolean;
  priceCents: number | null;
  includedInPro: boolean;
}

/** What the library page shows for each area of a car. Licensed scans are never downloadable (see B3.3), only usable in the workspace. */
export function offersFor(vehicle: Vehicle, areas: readonly ScanArea[]): AreaOffer[] {
  return areas.map((area) => {
    const available = vehicle.scanned.includes(area);
    return { area, label: AREA_LABELS[area], available, priceCents: available ? SCAN_AREA_PRICE_CENTS : null, includedInPro: available };
  });
}

export function carTitle(v: Vehicle): string {
  return `${v.make} ${v.model} (${v.generation}, ${v.yearFrom} to ${v.yearTo})`;
}
