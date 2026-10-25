import type { AgentAnchor } from "./types";

/**
 * Stand-in anchors until anchor fitting (B1.5) can produce real ones from a scan.
 * A flat panel with two 8 mm mounting holes 80 mm apart.
 */
export const FIXTURE_ANCHORS: AgentAnchor[] = [
  { id: "panel_face", type: "plane", point_mm: [0, 0, 0], normal: [0, 0, 1], note: "Flat panel face" },
  { id: "hole_a", type: "hole", point_mm: [-40, 0, 0], normal: [0, 0, 1], diameter_mm: 8, note: "Left mounting hole" },
  { id: "hole_b", type: "hole", point_mm: [40, 0, 0], normal: [0, 0, 1], diameter_mm: 8, note: "Right mounting hole" },
  { id: "edge_point", type: "point", point_mm: [0, 60, 0], normal: [0, 0, 1], note: "Point on the panel's upper edge" },
];
