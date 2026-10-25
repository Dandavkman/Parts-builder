/* Generated from services/geometry/src/geometry/spec/part-spec.schema.json. Do not edit. Run `pnpm generate`. */

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
  | Text;
export type Plate = {
  id: Id;
  type: "plate";
  width_mm?: LengthMm;
  length_mm?: LengthMm;
  thickness_mm: LengthMm;
  placement: Placement;
  outline_mm?: PointsMm;
} & Plate1;
/**
 * Unique feature id within the spec, referenced by other features.
 */
export type Id = string;
export type LengthMm = number;
/**
 * @minItems 3
 * @maxItems 64
 */
export type PointsMm = [PointMm, PointMm, PointMm, ...PointMm[]];
/**
 * A point [x, y] in millimeters in the plate's local frame, origin at the plate center.
 *
 * @minItems 2
 * @maxItems 2
 */
export type PointMm = [number, number];
export type Plate1 =
  | {
      [k: string]: unknown;
    }
  | {
      [k: string]: unknown;
    };
export type AngleDeg = number;
export type OutlineEdges = "vertical" | "top" | "bottom" | "all";

/**
 * Part Spec v1.0. A part described as features positioned against anchors. All lengths are in millimeters. Specs written for v0.1 stay valid and buildable.
 */
export interface PartSpec {
  spec_version: "0.1" | "1.0";
  name: string;
  /**
   * @minItems 1
   */
  features: [Feature, ...Feature[]];
}
/**
 * Where a feature sits. 'anchor' is an anchor id picked on the scan, or 'origin' for the part's own local origin. Offsets are relative to that anchor, never absolute.
 */
export interface Placement {
  anchor: string;
  /**
   * @minItems 3
   * @maxItems 3
   */
  offset_mm?: [number, number, number];
}
export interface Hole {
  id: Id;
  type: "hole";
  plate: Id;
  diameter_mm: LengthMm;
  position_mm: PointMm;
  /**
   * Id of a hole anchor on the scan that this hole should line up with. Used by the fit check.
   */
  align_anchor?: string;
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
export interface Counterbore {
  id: Id;
  type: "counterbore";
  plate: Id;
  diameter_mm: LengthMm;
  cbore_diameter_mm: LengthMm;
  cbore_depth_mm: LengthMm;
  position_mm: PointMm;
  /**
   * Id of a hole anchor on the scan that this hole should line up with. Used by the fit check.
   */
  align_anchor?: string;
}
export interface Countersink {
  id: Id;
  type: "countersink";
  plate: Id;
  diameter_mm: LengthMm;
  csk_diameter_mm: LengthMm;
  csk_angle_deg?: number;
  position_mm: PointMm;
  /**
   * Id of a hole anchor on the scan that this hole should line up with. Used by the fit check.
   */
  align_anchor?: string;
}
export interface Slot {
  id: Id;
  type: "slot";
  plate: Id;
  width_mm: LengthMm;
  length_mm: LengthMm;
  angle_deg?: AngleDeg;
  position_mm: PointMm;
}
export interface Standoff {
  id: Id;
  type: "standoff";
  plate: Id;
  outer_diameter_mm: LengthMm;
  height_mm: LengthMm;
  hole_diameter_mm?: LengthMm;
  position_mm: PointMm;
}
export interface Rib {
  id: Id;
  type: "rib";
  plate: Id;
  thickness_mm: LengthMm;
  height_mm: LengthMm;
  from_mm: PointMm;
  to_mm: PointMm;
  profile?: "rectangle" | "triangle";
}
export interface Bend {
  id: Id;
  type: "bend";
  plate: Id;
  edge: "+x" | "-x" | "+y" | "-y";
  flange_length_mm: LengthMm;
  inner_radius_mm?: number;
  angle_deg?: 90;
}
export interface Fillet {
  id: Id;
  type: "fillet";
  plate: Id;
  radius_mm: LengthMm;
  edges?: OutlineEdges;
}
export interface Chamfer {
  id: Id;
  type: "chamfer";
  plate: Id;
  size_mm: LengthMm;
  edges?: OutlineEdges;
}
export interface Cutout {
  id: Id;
  type: "cutout";
  plate: Id;
  shape:
    | {
        kind: "circle";
        diameter_mm: LengthMm;
      }
    | {
        kind: "rectangle";
        width_mm: LengthMm;
        length_mm: LengthMm;
      }
    | {
        kind: "polygon";
        points_mm: PointsMm;
      };
  angle_deg?: AngleDeg;
  position_mm: PointMm;
}
export interface Text {
  id: Id;
  type: "text";
  plate: Id;
  text: string;
  size_mm: number;
  depth_mm: number;
  mode?: "emboss" | "engrave";
  angle_deg?: AngleDeg;
  position_mm: PointMm;
}
