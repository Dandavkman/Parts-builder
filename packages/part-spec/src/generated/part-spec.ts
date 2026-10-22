/* Generated from services/geometry/src/geometry/spec/part-spec.schema.json. Do not edit. Run `pnpm generate`. */

export type Feature = Plate | Hole | HolePattern;
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
 * Part Spec v0.1 (draft). A part described as features positioned against anchors. All lengths are in millimeters.
 */
export interface PartSpec {
  spec_version: "0.1";
  name: string;
  /**
   * @minItems 1
   */
  features: [Feature, ...Feature[]];
}
export interface Plate {
  id: Id;
  type: "plate";
  width_mm: LengthMm;
  length_mm: LengthMm;
  thickness_mm: LengthMm;
  placement: Placement;
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
