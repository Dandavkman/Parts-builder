/** Areas of a car a library scan can cover. Fixed list so pages and tags stay consistent. */
export const SCAN_AREAS = ["dash", "center-console", "door-card", "engine-bay", "trunk", "underbody"] as const;
export type ScanArea = (typeof SCAN_AREAS)[number];

export interface Vehicle {
  id: string;
  make: string;
  model: string;
  /** Chassis or generation name, for example "NA". */
  generation: string;
  yearFrom: number;
  yearTo: number;
  /** Areas with a library scan. Empty means none yet. */
  scanned: ScanArea[];
}

/**
 * Starting catalog. Only the Miata NA is the Owner's real first vertical; its scan areas are what the
 * plan expects to exist first. Every other row is a placeholder so search and pages can be built and tested;
 * the Owner replaces this list (later it moves to the database, edited from the admin console).
 */
export const VEHICLES: Vehicle[] = [
  { id: "mazda-mx5-na", make: "Mazda", model: "MX-5 Miata", generation: "NA", yearFrom: 1989, yearTo: 1997, scanned: ["dash", "center-console"] },
  { id: "mazda-mx5-nb", make: "Mazda", model: "MX-5 Miata", generation: "NB", yearFrom: 1998, yearTo: 2005, scanned: [] },
  { id: "honda-civic-ek", make: "Honda", model: "Civic", generation: "EK", yearFrom: 1996, yearTo: 2000, scanned: [] },
  { id: "subaru-brz-zc6", make: "Subaru", model: "BRZ", generation: "ZC6", yearFrom: 2012, yearTo: 2020, scanned: [] },
];

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/**
 * Finds cars by any field. Every word in the query must match the make, model, generation or id
 * (prefix match, so "mia" finds Miata and "mx5" finds MX-5), or be a year inside the car's year range.
 * An empty query returns everything.
 */
export function searchVehicles(query: string, list: Vehicle[] = VEHICLES): Vehicle[] {
  const words = norm(query).split(" ").filter(Boolean);
  if (words.length === 0) return list;
  return list.filter((v) => {
    const tokens = norm(`${v.make} ${v.model} ${v.generation} ${v.id}`).split(" ");
    const joined = tokens.join("");
    return words.every((w) => {
      if (/^\d{4}$/.test(w)) return Number(w) >= v.yearFrom && Number(w) <= v.yearTo;
      return tokens.some((t) => t.startsWith(w)) || joined.includes(w);
    });
  });
}

export function getVehicle(id: string, list: Vehicle[] = VEHICLES): Vehicle | undefined {
  return list.find((v) => v.id === id);
}
