/* Generated from services/geometry/src/geometry/spec/part-spec.v2.schema.json. Do not edit. Run `pnpm generate`. */

export type Feature =
  | Plate
  | Body
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
export type Outline =
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
export type LengthMm = number;
/**
 * A point [x, y] in millimeters. In a plate or extrude outline it is in the plate's local frame, origin at the center. In a revolve profile it is [radius, z] from the axis and the base.
 *
 * @minItems 2
 * @maxItems 2
 */
export type PointMm = [number, number];

/**
 * Part Spec v2.0 (v1.1 plus solid bodies). A part described as features positioned against anchors. All lengths are in millimeters and all angles in degrees. A plate is a flat slab; a body is a solid with a height, optionally hollowed into a container. Features other than plates and bodies refer to a plate by id and use plate-local positions.
 */
export interface PartSpecV2 {
  spec_version: "2.0";
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
  outline: Outline;
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
/**
 * A solid with a height, for boxes, vases, cups and knobs. The body frame has its origin at the center of the base, Z up, so the base sits at Z = 0 and the top at Z = height_mm. 'shape' says how it is made; 'shell' hollows it; 'edge_fillet_mm' rounds the outer top and bottom edges; 'texture' adds vertical ridges or grooves on the outside wall.
 */
export interface Body {
  id: Id;
  type: "body";
  shape: Extrude | Revolve;
  shell?: Shell;
  /**
   * Radius that rounds the outer top and bottom edges. Must be smaller than the wall thickness when the body is hollow.
   */
  edge_fillet_mm?: number;
  placement: Placement;
  texture?: Texture;
}
/**
 * A prism: the outline, straight up by height_mm. A rectangle outline gives a box; a circle gives a cylinder.
 */
export interface Extrude {
  kind: "extrude";
  outline: Outline;
  height_mm: LengthMm;
}
/**
 * A solid of revolution about the body's Z axis: vases, cups, knobs, bottles. 'profile_mm' lists [radius, z] points of the outside surface from the base up to the rim, with z strictly increasing (no overhangs, so it prints without supports). The base is a flat disc from the axis out to the first point, and the top is closed flat unless the body is hollowed open at the top. Use many points for a smooth curve.
 */
export interface Revolve {
  kind: "revolve";
  /**
   * @minItems 2
   * @maxItems 100
   */
  profile_mm: [PointMm, PointMm, ...PointMm[]];
}
/**
 * Hollows the body, leaving walls of wall_thickness_mm. open 'top' removes the top face (a vase, cup or box); 'none' makes a closed hollow part. The base stays as thick as the walls.
 */
export interface Shell {
  wall_thickness_mm: LengthMm;
  open: "top" | "none";
}
/**
 * A repeating pattern of vertical stripes on the outside wall: 'ridges' stand out by depth_mm, 'grooves' are cut in by depth_mm (and must be shallower than the wall if the body is hollow). 'spacing_mm' is the distance between stripe centers along a flat side, or around the widest part of a round body. Stripes run the full height unless 'z_range_mm' [from, to] limits them. Supported on rectangle and circle extrusions and on revolved bodies.
 */
export interface Texture {
  kind: "ridges" | "grooves";
  width_mm: LengthMm;
  depth_mm: LengthMm;
  spacing_mm: LengthMm;
  /**
   * @minItems 2
   * @maxItems 2
   */
  z_range_mm?: [number, number];
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
