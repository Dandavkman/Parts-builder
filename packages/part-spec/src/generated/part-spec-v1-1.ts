/* Generated from services/geometry/src/geometry/spec/part-spec.v1_1.schema.json. Do not edit. Run `pnpm generate`. */

export type Feature =
  | Plate
  | Hole
  | HolePattern
  | Counterbore
  | Countersink
  | Slot
  | Standoff
  | Rib
  | Bend
  | Fillet
  | Chamfer
  | Cutout
  | EmbossText;
/**
 * Unique feature id within the spec, referenced by other features.
 */
export type Id = string;
export type LengthMm = number;
/**
 * A point [x, y] in millimeters in the plate's local frame, origin at the plate center.
 *
 * @minItems 2
 * @maxItems 2
 */
export type PointMm = [number, number];

/**
 * Part Spec v1.1 (v1 plus a circle outline). A part described as features positioned against anchors. All lengths are in millimeters and all angles in degrees. Features other than plates refer to a plate by id; the spec builder checks that the ids exist.
 */
export interface PartSpecV1_1 {
  spec_version: "1.1";
  name: string;
  /**
   * @minItems 1
   * @maxItems 200
   */
  features: [Feature, ...Feature[]];
}
export interface Plate {
  id: Id;
  type: "plate";
  outline:
    | {
        kind: "rectangle";
        width_mm: LengthMm;
        length_mm: LengthMm;
        corner_radius_mm?: number;
      }
    | {
        kind: "circle";
        diameter_mm: LengthMm;
      }
    | {
        kind: "polygon";
        /**
         * @minItems 3
         * @maxItems 200
         */
        points_mm: [PointMm, PointMm, PointMm, ...PointMm[]];
      };
  thickness_mm: LengthMm;
  placement: Placement;
}
/**
 * Where a feature sits. 'anchor' is an anchor id picked on the scan, or 'origin' for the part's own local origin. Offsets are relative to that anchor, never absolute. Rotation is about the anchor's normal or axis.
 */
export interface Placement {
  anchor: string;
  /**
   * @minItems 3
   * @maxItems 3
   */
  offset_mm?: [number, number, number];
  rotation_deg?: number;
}
export interface Hole {
  id: Id;
  type: "hole";
  plate: Id;
  diameter_mm: LengthMm;
  position_mm: PointMm;
}
export interface HolePattern {
  id: Id;
  type: "hole_pattern";
  plate: Id;
  diameter_mm: LengthMm;
  pattern:
    | {
        kind: "rectangular";
        center_mm?: PointMm;
        count_x: number;
        count_y: number;
        spacing_x_mm: LengthMm;
        spacing_y_mm: LengthMm;
      }
    | {
        kind: "circular";
        center_mm?: PointMm;
        count: number;
        radius_mm: LengthMm;
        start_angle_deg?: number;
      };
}
/**
 * A through hole with a flat-bottomed recess on the top face, for a bolt head.
 */
export interface Counterbore {
  id: Id;
  type: "counterbore";
  plate: Id;
  position_mm: PointMm;
  diameter_mm: LengthMm;
  bore_diameter_mm: LengthMm;
  bore_depth_mm: LengthMm;
}
/**
 * A through hole with a conical recess on the top face, for a flat-head screw.
 */
export interface Countersink {
  id: Id;
  type: "countersink";
  plate: Id;
  position_mm: PointMm;
  diameter_mm: LengthMm;
  sink_diameter_mm: LengthMm;
  sink_angle_deg?: number;
}
/**
 * A through slot with rounded ends. length_mm is end to end.
 */
export interface Slot {
  id: Id;
  type: "slot";
  plate: Id;
  position_mm: PointMm;
  length_mm: LengthMm;
  width_mm: LengthMm;
  angle_deg?: number;
}
/**
 * A round post standing on a plate face. A positive hole_diameter_mm drills it through the post and the plate.
 */
export interface Standoff {
  id: Id;
  type: "standoff";
  plate: Id;
  position_mm: PointMm;
  outer_diameter_mm: LengthMm;
  height_mm: LengthMm;
  hole_diameter_mm?: LengthMm;
  face?: "top" | "bottom";
}
/**
 * A thin wall standing on a plate face along a line. 'rectangular' is a rib of constant height. 'triangular' is a gusset whose height falls from height_mm at start_mm to zero at end_mm.
 */
export interface Rib {
  id: Id;
  type: "rib";
  plate: Id;
  start_mm: PointMm;
  end_mm: PointMm;
  thickness_mm: LengthMm;
  height_mm: LengthMm;
  profile?: "rectangular" | "triangular";
  face?: "top" | "bottom";
}
/**
 * Joins an edge of one plate to an edge of another through a rounded bend, making an L or other angled bracket. The second plate's own placement is ignored; the bend positions it.
 */
export interface Bend {
  id: Id;
  type: "bend";
  from_plate: Id;
  from_edge: "+x" | "-x" | "+y" | "-y";
  to_plate: Id;
  to_edge: "+x" | "-x" | "+y" | "-y";
  angle_deg: number;
  inner_radius_mm: number;
}
/**
 * Rounds edges of a plate. 'vertical' is the outline corners, 'top' and 'bottom' are the face outlines, 'all' is every edge.
 */
export interface Fillet {
  id: Id;
  type: "fillet";
  plate: Id;
  edges: "vertical" | "top" | "bottom" | "all";
  radius_mm: LengthMm;
}
/**
 * Bevels edges of a plate. Edge selection is the same as for fillet.
 */
export interface Chamfer {
  id: Id;
  type: "chamfer";
  plate: Id;
  edges: "vertical" | "top" | "bottom" | "all";
  distance_mm: LengthMm;
}
/**
 * A through cut around a clearance zone on the scan, such as a bolt head or a hose, positioned by an anchor. margin_mm grows the cut beyond the zone shape.
 */
export interface Cutout {
  id: Id;
  type: "cutout";
  plate: Id;
  placement: Placement;
  zone:
    | {
        kind: "circle";
        diameter_mm: LengthMm;
      }
    | {
        kind: "rectangle";
        width_mm: LengthMm;
        length_mm: LengthMm;
      };
  margin_mm?: number;
}
/**
 * Text raised from, or engraved into, a plate face. height_mm is the letter height; depth_mm is how far it rises or sinks.
 */
export interface EmbossText {
  id: Id;
  type: "emboss_text";
  plate: Id;
  position_mm: PointMm;
  text: string;
  height_mm: LengthMm;
  depth_mm: number;
  mode?: "raised" | "engraved";
  face?: "top" | "bottom";
  angle_deg?: number;
}
