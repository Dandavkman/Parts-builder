/** Metric coarse-thread hole sizes, in millimeters. Deterministic so the design agent never guesses them. */
export interface Fastener {
  size: string;
  major_mm: number;
  pitch_mm: number;
  /** Drill for a hole that will be tapped. */
  tap_drill_mm: number;
  /** Medium-fit through hole for a bolt of this size (ISO 273). */
  clearance_mm: number;
  /** Hole for a heat-set insert (typical brass insert; check the insert's data sheet). */
  insert_hole_mm: number;
  insert_depth_mm: number;
  /** Socket-head cap screw head: counterbore diameter and depth. */
  cbore_diameter_mm: number;
  cbore_depth_mm: number;
}

export const FASTENERS: Fastener[] = [
  { size: "M2", major_mm: 2, pitch_mm: 0.4, tap_drill_mm: 1.6, clearance_mm: 2.4, insert_hole_mm: 3.2, insert_depth_mm: 4, cbore_diameter_mm: 3.8, cbore_depth_mm: 2 },
  { size: "M2.5", major_mm: 2.5, pitch_mm: 0.45, tap_drill_mm: 2.05, clearance_mm: 2.9, insert_hole_mm: 3.8, insert_depth_mm: 5, cbore_diameter_mm: 4.5, cbore_depth_mm: 2.5 },
  { size: "M3", major_mm: 3, pitch_mm: 0.5, tap_drill_mm: 2.5, clearance_mm: 3.4, insert_hole_mm: 4.2, insert_depth_mm: 5.7, cbore_diameter_mm: 5.5, cbore_depth_mm: 3 },
  { size: "M4", major_mm: 4, pitch_mm: 0.7, tap_drill_mm: 3.3, clearance_mm: 4.5, insert_hole_mm: 5.6, insert_depth_mm: 8, cbore_diameter_mm: 7, cbore_depth_mm: 4 },
  { size: "M5", major_mm: 5, pitch_mm: 0.8, tap_drill_mm: 4.2, clearance_mm: 5.5, insert_hole_mm: 6.4, insert_depth_mm: 9.5, cbore_diameter_mm: 8.5, cbore_depth_mm: 5 },
  { size: "M6", major_mm: 6, pitch_mm: 1, tap_drill_mm: 5, clearance_mm: 6.6, insert_hole_mm: 8, insert_depth_mm: 12, cbore_diameter_mm: 10, cbore_depth_mm: 6 },
  { size: "M8", major_mm: 8, pitch_mm: 1.25, tap_drill_mm: 6.8, clearance_mm: 9, insert_hole_mm: 10.2, insert_depth_mm: 14, cbore_diameter_mm: 13, cbore_depth_mm: 8 },
  { size: "M10", major_mm: 10, pitch_mm: 1.5, tap_drill_mm: 8.5, clearance_mm: 11, insert_hole_mm: 12.5, insert_depth_mm: 16, cbore_diameter_mm: 16, cbore_depth_mm: 10 },
  { size: "M12", major_mm: 12, pitch_mm: 1.75, tap_drill_mm: 10.2, clearance_mm: 13.5, insert_hole_mm: 14.5, insert_depth_mm: 18, cbore_diameter_mm: 18, cbore_depth_mm: 12 },
];

/** Fine pitches for sizes the car vertical uses (tap drill = major - pitch). */
const FINE: Record<string, { pitch_mm: number; tap_drill_mm: number }> = {
  "M8x1": { pitch_mm: 1, tap_drill_mm: 7 },
  "M10x1.25": { pitch_mm: 1.25, tap_drill_mm: 8.8 },
  "M12x1.25": { pitch_mm: 1.25, tap_drill_mm: 10.8 },
  "M12x1.5": { pitch_mm: 1.5, tap_drill_mm: 10.5 },
};

export const FASTENER_KINDS = ["tap", "clearance", "insert", "counterbore"] as const;
export type FastenerKind = (typeof FASTENER_KINDS)[number];

/** Parses "M8", "m10x1.25" or "M 6" into a table row (fine pitches override the tap drill). */
export function lookupFastener(sizeInput: unknown, kind: unknown): string {
  if (typeof sizeInput !== "string") return "size must be text such as M6 or M10x1.25.";
  if (!FASTENER_KINDS.includes(kind as FastenerKind)) return `kind must be one of ${FASTENER_KINDS.join(", ")}.`;
  const key = sizeInput.trim().replace(/\s+/g, "").replace(/^m/, "M").replace(/X/, "x");
  const [coarse] = key.split("x");
  const row = FASTENERS.find((f) => f.size === coarse);
  if (!row) return `Unknown size ${sizeInput}. Known sizes: ${FASTENERS.map((f) => f.size).join(", ")}.`;
  const fine = key.includes("x") ? FINE[key] : undefined;
  if (key.includes("x") && !fine && Number(key.split("x")[1]) !== row.pitch_mm) {
    return `No data for ${key}. Use the coarse ${row.size}x${row.pitch_mm} or one of ${Object.keys(FINE).join(", ")}.`;
  }
  switch (kind as FastenerKind) {
    case "tap":
      return `${key}: drill a ${fine?.tap_drill_mm ?? row.tap_drill_mm} mm hole, then tap it (pitch ${fine?.pitch_mm ?? row.pitch_mm} mm). Never model the thread; tell the user to tap it.`;
    case "clearance":
      return `${row.size}: a ${row.clearance_mm} mm through hole lets a bolt pass freely.`;
    case "insert":
      return `${row.size}: for a heat-set brass insert drill ${row.insert_hole_mm} mm, at least ${row.insert_depth_mm} mm deep. Check the insert's data sheet; sizes vary by brand.`;
    case "counterbore":
      return `${row.size} socket-head screw: a ${row.cbore_diameter_mm} mm counterbore ${row.cbore_depth_mm} mm deep, over a ${row.clearance_mm} mm through hole.`;
  }
}
