/* Generated from services/geometry/src/geometry/spec/part-spec.v4_3.schema.json. Do not edit. Run `pnpm generate`. */

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
  | EmbossText
  | Tube
  | Merge
  | Reducer
  | Flange
  | Volute
  | Sketch
  | ExtrudeFeature
  | RevolveFeature
  | Boolean
  | Transform
  | Curve
  | Sweep
  | Loft
  | FilletEdges
  | ChamferEdges
  | Hollow
  | LinearPattern
  | CircularPattern
  | Mirror
  | Draft;
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
 * A closed 2D outline in the sketch plane (x, y in mm). 'circle', 'rectangle' (width along x) and 'ellipse' are centered on 'center_mm' (default [0, 0]). 'polygon' joins its points with straight lines. 'path' starts at 'start_mm' and follows 'segments': a 'line' to a point, a three-point 'arc' (through 'mid_mm' to 'to_mm') or a smooth 'spline' through the listed points (the last one is where it ends). A path closes itself back to its start with a straight line.
 */
export type SketchLoop =
  | {
      kind: "circle";
      center_mm?: SketchPoint;
      diameter_mm: number;
    }
  | {
      kind: "rectangle";
      center_mm?: SketchPoint;
      width_mm: number;
      height_mm: number;
    }
  | {
      kind: "ellipse";
      center_mm?: SketchPoint;
      major_mm: number;
      minor_mm: number;
      rotation_deg?: number;
    }
  | {
      kind: "polygon";
      /**
       * @minItems 3
       * @maxItems 256
       */
      points_mm: [SketchPoint, SketchPoint, SketchPoint, ...SketchPoint[]];
    }
  | {
      kind: "path";
      start_mm: SketchPoint;
      /**
       * @minItems 1
       * @maxItems 256
       */
      segments: [
        (
          | {
              kind: "line";
              to_mm: SketchPoint;
            }
          | {
              kind: "arc";
              mid_mm: SketchPoint;
              to_mm: SketchPoint;
            }
          | {
              kind: "spline";
              /**
               * @minItems 2
               * @maxItems 64
               */
              through_mm: [SketchPoint, SketchPoint, ...SketchPoint[]];
            }
        ),
        ...(
          | {
              kind: "line";
              to_mm: SketchPoint;
            }
          | {
              kind: "arc";
              mid_mm: SketchPoint;
              to_mm: SketchPoint;
            }
          | {
              kind: "spline";
              /**
               * @minItems 2
               * @maxItems 64
               */
              through_mm: [SketchPoint, SketchPoint, ...SketchPoint[]];
            }
        )[]
      ];
    };
/**
 * @minItems 2
 * @maxItems 2
 */
export type SketchPoint = [number, number];
/**
 * Which edges. 'all', or a list of choices whose edges are combined: {parallel: X|Y|Z} straight edges running along that axis; {on_face: top|bottom|left|right|front|back} edges of the outermost face on that side (top +Z, bottom -Z, right +X, left -X, back +Y, front -Y); {near_mm: [x,y,z], within_mm: r} edges whose middle lies within r of the point.
 */
export type EdgeSelector =
  | "all"
  | [
      | {
          parallel: "X" | "Y" | "Z";
        }
      | {
          on_face: "top" | "bottom" | "left" | "right" | "front" | "back";
        }
      | {
          /**
           * @minItems 3
           * @maxItems 3
           */
          near_mm: [number, number, number];
          within_mm: number;
        }
    ]
  | [
      (
        | {
            parallel: "X" | "Y" | "Z";
          }
        | {
            on_face: "top" | "bottom" | "left" | "right" | "front" | "back";
          }
        | {
            /**
             * @minItems 3
             * @maxItems 3
             */
            near_mm: [number, number, number];
            within_mm: number;
          }
      ),
      (
        | {
            parallel: "X" | "Y" | "Z";
          }
        | {
            on_face: "top" | "bottom" | "left" | "right" | "front" | "back";
          }
        | {
            /**
             * @minItems 3
             * @maxItems 3
             */
            near_mm: [number, number, number];
            within_mm: number;
          }
      )
    ]
  | [
      (
        | {
            parallel: "X" | "Y" | "Z";
          }
        | {
            on_face: "top" | "bottom" | "left" | "right" | "front" | "back";
          }
        | {
            /**
             * @minItems 3
             * @maxItems 3
             */
            near_mm: [number, number, number];
            within_mm: number;
          }
      ),
      (
        | {
            parallel: "X" | "Y" | "Z";
          }
        | {
            on_face: "top" | "bottom" | "left" | "right" | "front" | "back";
          }
        | {
            /**
             * @minItems 3
             * @maxItems 3
             */
            near_mm: [number, number, number];
            within_mm: number;
          }
      ),
      (
        | {
            parallel: "X" | "Y" | "Z";
          }
        | {
            on_face: "top" | "bottom" | "left" | "right" | "front" | "back";
          }
        | {
            /**
             * @minItems 3
             * @maxItems 3
             */
            near_mm: [number, number, number];
            within_mm: number;
          }
      )
    ]
  | [
      (
        | {
            parallel: "X" | "Y" | "Z";
          }
        | {
            on_face: "top" | "bottom" | "left" | "right" | "front" | "back";
          }
        | {
            /**
             * @minItems 3
             * @maxItems 3
             */
            near_mm: [number, number, number];
            within_mm: number;
          }
      ),
      (
        | {
            parallel: "X" | "Y" | "Z";
          }
        | {
            on_face: "top" | "bottom" | "left" | "right" | "front" | "back";
          }
        | {
            /**
             * @minItems 3
             * @maxItems 3
             */
            near_mm: [number, number, number];
            within_mm: number;
          }
      ),
      (
        | {
            parallel: "X" | "Y" | "Z";
          }
        | {
            on_face: "top" | "bottom" | "left" | "right" | "front" | "back";
          }
        | {
            /**
             * @minItems 3
             * @maxItems 3
             */
            near_mm: [number, number, number];
            within_mm: number;
          }
      ),
      (
        | {
            parallel: "X" | "Y" | "Z";
          }
        | {
            on_face: "top" | "bottom" | "left" | "right" | "front" | "back";
          }
        | {
            /**
             * @minItems 3
             * @maxItems 3
             */
            near_mm: [number, number, number];
            within_mm: number;
          }
      )
    ]
  | [
      (
        | {
            parallel: "X" | "Y" | "Z";
          }
        | {
            on_face: "top" | "bottom" | "left" | "right" | "front" | "back";
          }
        | {
            /**
             * @minItems 3
             * @maxItems 3
             */
            near_mm: [number, number, number];
            within_mm: number;
          }
      ),
      (
        | {
            parallel: "X" | "Y" | "Z";
          }
        | {
            on_face: "top" | "bottom" | "left" | "right" | "front" | "back";
          }
        | {
            /**
             * @minItems 3
             * @maxItems 3
             */
            near_mm: [number, number, number];
            within_mm: number;
          }
      ),
      (
        | {
            parallel: "X" | "Y" | "Z";
          }
        | {
            on_face: "top" | "bottom" | "left" | "right" | "front" | "back";
          }
        | {
            /**
             * @minItems 3
             * @maxItems 3
             */
            near_mm: [number, number, number];
            within_mm: number;
          }
      ),
      (
        | {
            parallel: "X" | "Y" | "Z";
          }
        | {
            on_face: "top" | "bottom" | "left" | "right" | "front" | "back";
          }
        | {
            /**
             * @minItems 3
             * @maxItems 3
             */
            near_mm: [number, number, number];
            within_mm: number;
          }
      ),
      (
        | {
            parallel: "X" | "Y" | "Z";
          }
        | {
            on_face: "top" | "bottom" | "left" | "right" | "front" | "back";
          }
        | {
            /**
             * @minItems 3
             * @maxItems 3
             */
            near_mm: [number, number, number];
            within_mm: number;
          }
      )
    ]
  | [
      (
        | {
            parallel: "X" | "Y" | "Z";
          }
        | {
            on_face: "top" | "bottom" | "left" | "right" | "front" | "back";
          }
        | {
            /**
             * @minItems 3
             * @maxItems 3
             */
            near_mm: [number, number, number];
            within_mm: number;
          }
      ),
      (
        | {
            parallel: "X" | "Y" | "Z";
          }
        | {
            on_face: "top" | "bottom" | "left" | "right" | "front" | "back";
          }
        | {
            /**
             * @minItems 3
             * @maxItems 3
             */
            near_mm: [number, number, number];
            within_mm: number;
          }
      ),
      (
        | {
            parallel: "X" | "Y" | "Z";
          }
        | {
            on_face: "top" | "bottom" | "left" | "right" | "front" | "back";
          }
        | {
            /**
             * @minItems 3
             * @maxItems 3
             */
            near_mm: [number, number, number];
            within_mm: number;
          }
      ),
      (
        | {
            parallel: "X" | "Y" | "Z";
          }
        | {
            on_face: "top" | "bottom" | "left" | "right" | "front" | "back";
          }
        | {
            /**
             * @minItems 3
             * @maxItems 3
             */
            near_mm: [number, number, number];
            within_mm: number;
          }
      ),
      (
        | {
            parallel: "X" | "Y" | "Z";
          }
        | {
            on_face: "top" | "bottom" | "left" | "right" | "front" | "back";
          }
        | {
            /**
             * @minItems 3
             * @maxItems 3
             */
            near_mm: [number, number, number];
            within_mm: number;
          }
      ),
      (
        | {
            parallel: "X" | "Y" | "Z";
          }
        | {
            on_face: "top" | "bottom" | "left" | "right" | "front" | "back";
          }
        | {
            /**
             * @minItems 3
             * @maxItems 3
             */
            near_mm: [number, number, number];
            within_mm: number;
          }
      )
    ]
  | [
      (
        | {
            parallel: "X" | "Y" | "Z";
          }
        | {
            on_face: "top" | "bottom" | "left" | "right" | "front" | "back";
          }
        | {
            /**
             * @minItems 3
             * @maxItems 3
             */
            near_mm: [number, number, number];
            within_mm: number;
          }
      ),
      (
        | {
            parallel: "X" | "Y" | "Z";
          }
        | {
            on_face: "top" | "bottom" | "left" | "right" | "front" | "back";
          }
        | {
            /**
             * @minItems 3
             * @maxItems 3
             */
            near_mm: [number, number, number];
            within_mm: number;
          }
      ),
      (
        | {
            parallel: "X" | "Y" | "Z";
          }
        | {
            on_face: "top" | "bottom" | "left" | "right" | "front" | "back";
          }
        | {
            /**
             * @minItems 3
             * @maxItems 3
             */
            near_mm: [number, number, number];
            within_mm: number;
          }
      ),
      (
        | {
            parallel: "X" | "Y" | "Z";
          }
        | {
            on_face: "top" | "bottom" | "left" | "right" | "front" | "back";
          }
        | {
            /**
             * @minItems 3
             * @maxItems 3
             */
            near_mm: [number, number, number];
            within_mm: number;
          }
      ),
      (
        | {
            parallel: "X" | "Y" | "Z";
          }
        | {
            on_face: "top" | "bottom" | "left" | "right" | "front" | "back";
          }
        | {
            /**
             * @minItems 3
             * @maxItems 3
             */
            near_mm: [number, number, number];
            within_mm: number;
          }
      ),
      (
        | {
            parallel: "X" | "Y" | "Z";
          }
        | {
            on_face: "top" | "bottom" | "left" | "right" | "front" | "back";
          }
        | {
            /**
             * @minItems 3
             * @maxItems 3
             */
            near_mm: [number, number, number];
            within_mm: number;
          }
      ),
      (
        | {
            parallel: "X" | "Y" | "Z";
          }
        | {
            on_face: "top" | "bottom" | "left" | "right" | "front" | "back";
          }
        | {
            /**
             * @minItems 3
             * @maxItems 3
             */
            near_mm: [number, number, number];
            within_mm: number;
          }
      )
    ]
  | [
      (
        | {
            parallel: "X" | "Y" | "Z";
          }
        | {
            on_face: "top" | "bottom" | "left" | "right" | "front" | "back";
          }
        | {
            /**
             * @minItems 3
             * @maxItems 3
             */
            near_mm: [number, number, number];
            within_mm: number;
          }
      ),
      (
        | {
            parallel: "X" | "Y" | "Z";
          }
        | {
            on_face: "top" | "bottom" | "left" | "right" | "front" | "back";
          }
        | {
            /**
             * @minItems 3
             * @maxItems 3
             */
            near_mm: [number, number, number];
            within_mm: number;
          }
      ),
      (
        | {
            parallel: "X" | "Y" | "Z";
          }
        | {
            on_face: "top" | "bottom" | "left" | "right" | "front" | "back";
          }
        | {
            /**
             * @minItems 3
             * @maxItems 3
             */
            near_mm: [number, number, number];
            within_mm: number;
          }
      ),
      (
        | {
            parallel: "X" | "Y" | "Z";
          }
        | {
            on_face: "top" | "bottom" | "left" | "right" | "front" | "back";
          }
        | {
            /**
             * @minItems 3
             * @maxItems 3
             */
            near_mm: [number, number, number];
            within_mm: number;
          }
      ),
      (
        | {
            parallel: "X" | "Y" | "Z";
          }
        | {
            on_face: "top" | "bottom" | "left" | "right" | "front" | "back";
          }
        | {
            /**
             * @minItems 3
             * @maxItems 3
             */
            near_mm: [number, number, number];
            within_mm: number;
          }
      ),
      (
        | {
            parallel: "X" | "Y" | "Z";
          }
        | {
            on_face: "top" | "bottom" | "left" | "right" | "front" | "back";
          }
        | {
            /**
             * @minItems 3
             * @maxItems 3
             */
            near_mm: [number, number, number];
            within_mm: number;
          }
      ),
      (
        | {
            parallel: "X" | "Y" | "Z";
          }
        | {
            on_face: "top" | "bottom" | "left" | "right" | "front" | "back";
          }
        | {
            /**
             * @minItems 3
             * @maxItems 3
             */
            near_mm: [number, number, number];
            within_mm: number;
          }
      ),
      (
        | {
            parallel: "X" | "Y" | "Z";
          }
        | {
            on_face: "top" | "bottom" | "left" | "right" | "front" | "back";
          }
        | {
            /**
             * @minItems 3
             * @maxItems 3
             */
            near_mm: [number, number, number];
            within_mm: number;
          }
      )
    ]
  | [
      (
        | {
            parallel: "X" | "Y" | "Z";
          }
        | {
            on_face: "top" | "bottom" | "left" | "right" | "front" | "back";
          }
        | {
            /**
             * @minItems 3
             * @maxItems 3
             */
            near_mm: [number, number, number];
            within_mm: number;
          }
      ),
      (
        | {
            parallel: "X" | "Y" | "Z";
          }
        | {
            on_face: "top" | "bottom" | "left" | "right" | "front" | "back";
          }
        | {
            /**
             * @minItems 3
             * @maxItems 3
             */
            near_mm: [number, number, number];
            within_mm: number;
          }
      ),
      (
        | {
            parallel: "X" | "Y" | "Z";
          }
        | {
            on_face: "top" | "bottom" | "left" | "right" | "front" | "back";
          }
        | {
            /**
             * @minItems 3
             * @maxItems 3
             */
            near_mm: [number, number, number];
            within_mm: number;
          }
      ),
      (
        | {
            parallel: "X" | "Y" | "Z";
          }
        | {
            on_face: "top" | "bottom" | "left" | "right" | "front" | "back";
          }
        | {
            /**
             * @minItems 3
             * @maxItems 3
             */
            near_mm: [number, number, number];
            within_mm: number;
          }
      ),
      (
        | {
            parallel: "X" | "Y" | "Z";
          }
        | {
            on_face: "top" | "bottom" | "left" | "right" | "front" | "back";
          }
        | {
            /**
             * @minItems 3
             * @maxItems 3
             */
            near_mm: [number, number, number];
            within_mm: number;
          }
      ),
      (
        | {
            parallel: "X" | "Y" | "Z";
          }
        | {
            on_face: "top" | "bottom" | "left" | "right" | "front" | "back";
          }
        | {
            /**
             * @minItems 3
             * @maxItems 3
             */
            near_mm: [number, number, number];
            within_mm: number;
          }
      ),
      (
        | {
            parallel: "X" | "Y" | "Z";
          }
        | {
            on_face: "top" | "bottom" | "left" | "right" | "front" | "back";
          }
        | {
            /**
             * @minItems 3
             * @maxItems 3
             */
            near_mm: [number, number, number];
            within_mm: number;
          }
      ),
      (
        | {
            parallel: "X" | "Y" | "Z";
          }
        | {
            on_face: "top" | "bottom" | "left" | "right" | "front" | "back";
          }
        | {
            /**
             * @minItems 3
             * @maxItems 3
             */
            near_mm: [number, number, number];
            within_mm: number;
          }
      ),
      (
        | {
            parallel: "X" | "Y" | "Z";
          }
        | {
            on_face: "top" | "bottom" | "left" | "right" | "front" | "back";
          }
        | {
            /**
             * @minItems 3
             * @maxItems 3
             */
            near_mm: [number, number, number];
            within_mm: number;
          }
      )
    ]
  | [
      (
        | {
            parallel: "X" | "Y" | "Z";
          }
        | {
            on_face: "top" | "bottom" | "left" | "right" | "front" | "back";
          }
        | {
            /**
             * @minItems 3
             * @maxItems 3
             */
            near_mm: [number, number, number];
            within_mm: number;
          }
      ),
      (
        | {
            parallel: "X" | "Y" | "Z";
          }
        | {
            on_face: "top" | "bottom" | "left" | "right" | "front" | "back";
          }
        | {
            /**
             * @minItems 3
             * @maxItems 3
             */
            near_mm: [number, number, number];
            within_mm: number;
          }
      ),
      (
        | {
            parallel: "X" | "Y" | "Z";
          }
        | {
            on_face: "top" | "bottom" | "left" | "right" | "front" | "back";
          }
        | {
            /**
             * @minItems 3
             * @maxItems 3
             */
            near_mm: [number, number, number];
            within_mm: number;
          }
      ),
      (
        | {
            parallel: "X" | "Y" | "Z";
          }
        | {
            on_face: "top" | "bottom" | "left" | "right" | "front" | "back";
          }
        | {
            /**
             * @minItems 3
             * @maxItems 3
             */
            near_mm: [number, number, number];
            within_mm: number;
          }
      ),
      (
        | {
            parallel: "X" | "Y" | "Z";
          }
        | {
            on_face: "top" | "bottom" | "left" | "right" | "front" | "back";
          }
        | {
            /**
             * @minItems 3
             * @maxItems 3
             */
            near_mm: [number, number, number];
            within_mm: number;
          }
      ),
      (
        | {
            parallel: "X" | "Y" | "Z";
          }
        | {
            on_face: "top" | "bottom" | "left" | "right" | "front" | "back";
          }
        | {
            /**
             * @minItems 3
             * @maxItems 3
             */
            near_mm: [number, number, number];
            within_mm: number;
          }
      ),
      (
        | {
            parallel: "X" | "Y" | "Z";
          }
        | {
            on_face: "top" | "bottom" | "left" | "right" | "front" | "back";
          }
        | {
            /**
             * @minItems 3
             * @maxItems 3
             */
            near_mm: [number, number, number];
            within_mm: number;
          }
      ),
      (
        | {
            parallel: "X" | "Y" | "Z";
          }
        | {
            on_face: "top" | "bottom" | "left" | "right" | "front" | "back";
          }
        | {
            /**
             * @minItems 3
             * @maxItems 3
             */
            near_mm: [number, number, number];
            within_mm: number;
          }
      ),
      (
        | {
            parallel: "X" | "Y" | "Z";
          }
        | {
            on_face: "top" | "bottom" | "left" | "right" | "front" | "back";
          }
        | {
            /**
             * @minItems 3
             * @maxItems 3
             */
            near_mm: [number, number, number];
            within_mm: number;
          }
      ),
      (
        | {
            parallel: "X" | "Y" | "Z";
          }
        | {
            on_face: "top" | "bottom" | "left" | "right" | "front" | "back";
          }
        | {
            /**
             * @minItems 3
             * @maxItems 3
             */
            near_mm: [number, number, number];
            within_mm: number;
          }
      )
    ]
  | [
      (
        | {
            parallel: "X" | "Y" | "Z";
          }
        | {
            on_face: "top" | "bottom" | "left" | "right" | "front" | "back";
          }
        | {
            /**
             * @minItems 3
             * @maxItems 3
             */
            near_mm: [number, number, number];
            within_mm: number;
          }
      ),
      (
        | {
            parallel: "X" | "Y" | "Z";
          }
        | {
            on_face: "top" | "bottom" | "left" | "right" | "front" | "back";
          }
        | {
            /**
             * @minItems 3
             * @maxItems 3
             */
            near_mm: [number, number, number];
            within_mm: number;
          }
      ),
      (
        | {
            parallel: "X" | "Y" | "Z";
          }
        | {
            on_face: "top" | "bottom" | "left" | "right" | "front" | "back";
          }
        | {
            /**
             * @minItems 3
             * @maxItems 3
             */
            near_mm: [number, number, number];
            within_mm: number;
          }
      ),
      (
        | {
            parallel: "X" | "Y" | "Z";
          }
        | {
            on_face: "top" | "bottom" | "left" | "right" | "front" | "back";
          }
        | {
            /**
             * @minItems 3
             * @maxItems 3
             */
            near_mm: [number, number, number];
            within_mm: number;
          }
      ),
      (
        | {
            parallel: "X" | "Y" | "Z";
          }
        | {
            on_face: "top" | "bottom" | "left" | "right" | "front" | "back";
          }
        | {
            /**
             * @minItems 3
             * @maxItems 3
             */
            near_mm: [number, number, number];
            within_mm: number;
          }
      ),
      (
        | {
            parallel: "X" | "Y" | "Z";
          }
        | {
            on_face: "top" | "bottom" | "left" | "right" | "front" | "back";
          }
        | {
            /**
             * @minItems 3
             * @maxItems 3
             */
            near_mm: [number, number, number];
            within_mm: number;
          }
      ),
      (
        | {
            parallel: "X" | "Y" | "Z";
          }
        | {
            on_face: "top" | "bottom" | "left" | "right" | "front" | "back";
          }
        | {
            /**
             * @minItems 3
             * @maxItems 3
             */
            near_mm: [number, number, number];
            within_mm: number;
          }
      ),
      (
        | {
            parallel: "X" | "Y" | "Z";
          }
        | {
            on_face: "top" | "bottom" | "left" | "right" | "front" | "back";
          }
        | {
            /**
             * @minItems 3
             * @maxItems 3
             */
            near_mm: [number, number, number];
            within_mm: number;
          }
      ),
      (
        | {
            parallel: "X" | "Y" | "Z";
          }
        | {
            on_face: "top" | "bottom" | "left" | "right" | "front" | "back";
          }
        | {
            /**
             * @minItems 3
             * @maxItems 3
             */
            near_mm: [number, number, number];
            within_mm: number;
          }
      ),
      (
        | {
            parallel: "X" | "Y" | "Z";
          }
        | {
            on_face: "top" | "bottom" | "left" | "right" | "front" | "back";
          }
        | {
            /**
             * @minItems 3
             * @maxItems 3
             */
            near_mm: [number, number, number];
            within_mm: number;
          }
      ),
      (
        | {
            parallel: "X" | "Y" | "Z";
          }
        | {
            on_face: "top" | "bottom" | "left" | "right" | "front" | "back";
          }
        | {
            /**
             * @minItems 3
             * @maxItems 3
             */
            near_mm: [number, number, number];
            within_mm: number;
          }
      )
    ]
  | [
      (
        | {
            parallel: "X" | "Y" | "Z";
          }
        | {
            on_face: "top" | "bottom" | "left" | "right" | "front" | "back";
          }
        | {
            /**
             * @minItems 3
             * @maxItems 3
             */
            near_mm: [number, number, number];
            within_mm: number;
          }
      ),
      (
        | {
            parallel: "X" | "Y" | "Z";
          }
        | {
            on_face: "top" | "bottom" | "left" | "right" | "front" | "back";
          }
        | {
            /**
             * @minItems 3
             * @maxItems 3
             */
            near_mm: [number, number, number];
            within_mm: number;
          }
      ),
      (
        | {
            parallel: "X" | "Y" | "Z";
          }
        | {
            on_face: "top" | "bottom" | "left" | "right" | "front" | "back";
          }
        | {
            /**
             * @minItems 3
             * @maxItems 3
             */
            near_mm: [number, number, number];
            within_mm: number;
          }
      ),
      (
        | {
            parallel: "X" | "Y" | "Z";
          }
        | {
            on_face: "top" | "bottom" | "left" | "right" | "front" | "back";
          }
        | {
            /**
             * @minItems 3
             * @maxItems 3
             */
            near_mm: [number, number, number];
            within_mm: number;
          }
      ),
      (
        | {
            parallel: "X" | "Y" | "Z";
          }
        | {
            on_face: "top" | "bottom" | "left" | "right" | "front" | "back";
          }
        | {
            /**
             * @minItems 3
             * @maxItems 3
             */
            near_mm: [number, number, number];
            within_mm: number;
          }
      ),
      (
        | {
            parallel: "X" | "Y" | "Z";
          }
        | {
            on_face: "top" | "bottom" | "left" | "right" | "front" | "back";
          }
        | {
            /**
             * @minItems 3
             * @maxItems 3
             */
            near_mm: [number, number, number];
            within_mm: number;
          }
      ),
      (
        | {
            parallel: "X" | "Y" | "Z";
          }
        | {
            on_face: "top" | "bottom" | "left" | "right" | "front" | "back";
          }
        | {
            /**
             * @minItems 3
             * @maxItems 3
             */
            near_mm: [number, number, number];
            within_mm: number;
          }
      ),
      (
        | {
            parallel: "X" | "Y" | "Z";
          }
        | {
            on_face: "top" | "bottom" | "left" | "right" | "front" | "back";
          }
        | {
            /**
             * @minItems 3
             * @maxItems 3
             */
            near_mm: [number, number, number];
            within_mm: number;
          }
      ),
      (
        | {
            parallel: "X" | "Y" | "Z";
          }
        | {
            on_face: "top" | "bottom" | "left" | "right" | "front" | "back";
          }
        | {
            /**
             * @minItems 3
             * @maxItems 3
             */
            near_mm: [number, number, number];
            within_mm: number;
          }
      ),
      (
        | {
            parallel: "X" | "Y" | "Z";
          }
        | {
            on_face: "top" | "bottom" | "left" | "right" | "front" | "back";
          }
        | {
            /**
             * @minItems 3
             * @maxItems 3
             */
            near_mm: [number, number, number];
            within_mm: number;
          }
      ),
      (
        | {
            parallel: "X" | "Y" | "Z";
          }
        | {
            on_face: "top" | "bottom" | "left" | "right" | "front" | "back";
          }
        | {
            /**
             * @minItems 3
             * @maxItems 3
             */
            near_mm: [number, number, number];
            within_mm: number;
          }
      ),
      (
        | {
            parallel: "X" | "Y" | "Z";
          }
        | {
            on_face: "top" | "bottom" | "left" | "right" | "front" | "back";
          }
        | {
            /**
             * @minItems 3
             * @maxItems 3
             */
            near_mm: [number, number, number];
            within_mm: number;
          }
      )
    ]
  | [
      (
        | {
            parallel: "X" | "Y" | "Z";
          }
        | {
            on_face: "top" | "bottom" | "left" | "right" | "front" | "back";
          }
        | {
            /**
             * @minItems 3
             * @maxItems 3
             */
            near_mm: [number, number, number];
            within_mm: number;
          }
      ),
      (
        | {
            parallel: "X" | "Y" | "Z";
          }
        | {
            on_face: "top" | "bottom" | "left" | "right" | "front" | "back";
          }
        | {
            /**
             * @minItems 3
             * @maxItems 3
             */
            near_mm: [number, number, number];
            within_mm: number;
          }
      ),
      (
        | {
            parallel: "X" | "Y" | "Z";
          }
        | {
            on_face: "top" | "bottom" | "left" | "right" | "front" | "back";
          }
        | {
            /**
             * @minItems 3
             * @maxItems 3
             */
            near_mm: [number, number, number];
            within_mm: number;
          }
      ),
      (
        | {
            parallel: "X" | "Y" | "Z";
          }
        | {
            on_face: "top" | "bottom" | "left" | "right" | "front" | "back";
          }
        | {
            /**
             * @minItems 3
             * @maxItems 3
             */
            near_mm: [number, number, number];
            within_mm: number;
          }
      ),
      (
        | {
            parallel: "X" | "Y" | "Z";
          }
        | {
            on_face: "top" | "bottom" | "left" | "right" | "front" | "back";
          }
        | {
            /**
             * @minItems 3
             * @maxItems 3
             */
            near_mm: [number, number, number];
            within_mm: number;
          }
      ),
      (
        | {
            parallel: "X" | "Y" | "Z";
          }
        | {
            on_face: "top" | "bottom" | "left" | "right" | "front" | "back";
          }
        | {
            /**
             * @minItems 3
             * @maxItems 3
             */
            near_mm: [number, number, number];
            within_mm: number;
          }
      ),
      (
        | {
            parallel: "X" | "Y" | "Z";
          }
        | {
            on_face: "top" | "bottom" | "left" | "right" | "front" | "back";
          }
        | {
            /**
             * @minItems 3
             * @maxItems 3
             */
            near_mm: [number, number, number];
            within_mm: number;
          }
      ),
      (
        | {
            parallel: "X" | "Y" | "Z";
          }
        | {
            on_face: "top" | "bottom" | "left" | "right" | "front" | "back";
          }
        | {
            /**
             * @minItems 3
             * @maxItems 3
             */
            near_mm: [number, number, number];
            within_mm: number;
          }
      ),
      (
        | {
            parallel: "X" | "Y" | "Z";
          }
        | {
            on_face: "top" | "bottom" | "left" | "right" | "front" | "back";
          }
        | {
            /**
             * @minItems 3
             * @maxItems 3
             */
            near_mm: [number, number, number];
            within_mm: number;
          }
      ),
      (
        | {
            parallel: "X" | "Y" | "Z";
          }
        | {
            on_face: "top" | "bottom" | "left" | "right" | "front" | "back";
          }
        | {
            /**
             * @minItems 3
             * @maxItems 3
             */
            near_mm: [number, number, number];
            within_mm: number;
          }
      ),
      (
        | {
            parallel: "X" | "Y" | "Z";
          }
        | {
            on_face: "top" | "bottom" | "left" | "right" | "front" | "back";
          }
        | {
            /**
             * @minItems 3
             * @maxItems 3
             */
            near_mm: [number, number, number];
            within_mm: number;
          }
      ),
      (
        | {
            parallel: "X" | "Y" | "Z";
          }
        | {
            on_face: "top" | "bottom" | "left" | "right" | "front" | "back";
          }
        | {
            /**
             * @minItems 3
             * @maxItems 3
             */
            near_mm: [number, number, number];
            within_mm: number;
          }
      ),
      (
        | {
            parallel: "X" | "Y" | "Z";
          }
        | {
            on_face: "top" | "bottom" | "left" | "right" | "front" | "back";
          }
        | {
            /**
             * @minItems 3
             * @maxItems 3
             */
            near_mm: [number, number, number];
            within_mm: number;
          }
      )
    ]
  | [
      (
        | {
            parallel: "X" | "Y" | "Z";
          }
        | {
            on_face: "top" | "bottom" | "left" | "right" | "front" | "back";
          }
        | {
            /**
             * @minItems 3
             * @maxItems 3
             */
            near_mm: [number, number, number];
            within_mm: number;
          }
      ),
      (
        | {
            parallel: "X" | "Y" | "Z";
          }
        | {
            on_face: "top" | "bottom" | "left" | "right" | "front" | "back";
          }
        | {
            /**
             * @minItems 3
             * @maxItems 3
             */
            near_mm: [number, number, number];
            within_mm: number;
          }
      ),
      (
        | {
            parallel: "X" | "Y" | "Z";
          }
        | {
            on_face: "top" | "bottom" | "left" | "right" | "front" | "back";
          }
        | {
            /**
             * @minItems 3
             * @maxItems 3
             */
            near_mm: [number, number, number];
            within_mm: number;
          }
      ),
      (
        | {
            parallel: "X" | "Y" | "Z";
          }
        | {
            on_face: "top" | "bottom" | "left" | "right" | "front" | "back";
          }
        | {
            /**
             * @minItems 3
             * @maxItems 3
             */
            near_mm: [number, number, number];
            within_mm: number;
          }
      ),
      (
        | {
            parallel: "X" | "Y" | "Z";
          }
        | {
            on_face: "top" | "bottom" | "left" | "right" | "front" | "back";
          }
        | {
            /**
             * @minItems 3
             * @maxItems 3
             */
            near_mm: [number, number, number];
            within_mm: number;
          }
      ),
      (
        | {
            parallel: "X" | "Y" | "Z";
          }
        | {
            on_face: "top" | "bottom" | "left" | "right" | "front" | "back";
          }
        | {
            /**
             * @minItems 3
             * @maxItems 3
             */
            near_mm: [number, number, number];
            within_mm: number;
          }
      ),
      (
        | {
            parallel: "X" | "Y" | "Z";
          }
        | {
            on_face: "top" | "bottom" | "left" | "right" | "front" | "back";
          }
        | {
            /**
             * @minItems 3
             * @maxItems 3
             */
            near_mm: [number, number, number];
            within_mm: number;
          }
      ),
      (
        | {
            parallel: "X" | "Y" | "Z";
          }
        | {
            on_face: "top" | "bottom" | "left" | "right" | "front" | "back";
          }
        | {
            /**
             * @minItems 3
             * @maxItems 3
             */
            near_mm: [number, number, number];
            within_mm: number;
          }
      ),
      (
        | {
            parallel: "X" | "Y" | "Z";
          }
        | {
            on_face: "top" | "bottom" | "left" | "right" | "front" | "back";
          }
        | {
            /**
             * @minItems 3
             * @maxItems 3
             */
            near_mm: [number, number, number];
            within_mm: number;
          }
      ),
      (
        | {
            parallel: "X" | "Y" | "Z";
          }
        | {
            on_face: "top" | "bottom" | "left" | "right" | "front" | "back";
          }
        | {
            /**
             * @minItems 3
             * @maxItems 3
             */
            near_mm: [number, number, number];
            within_mm: number;
          }
      ),
      (
        | {
            parallel: "X" | "Y" | "Z";
          }
        | {
            on_face: "top" | "bottom" | "left" | "right" | "front" | "back";
          }
        | {
            /**
             * @minItems 3
             * @maxItems 3
             */
            near_mm: [number, number, number];
            within_mm: number;
          }
      ),
      (
        | {
            parallel: "X" | "Y" | "Z";
          }
        | {
            on_face: "top" | "bottom" | "left" | "right" | "front" | "back";
          }
        | {
            /**
             * @minItems 3
             * @maxItems 3
             */
            near_mm: [number, number, number];
            within_mm: number;
          }
      ),
      (
        | {
            parallel: "X" | "Y" | "Z";
          }
        | {
            on_face: "top" | "bottom" | "left" | "right" | "front" | "back";
          }
        | {
            /**
             * @minItems 3
             * @maxItems 3
             */
            near_mm: [number, number, number];
            within_mm: number;
          }
      ),
      (
        | {
            parallel: "X" | "Y" | "Z";
          }
        | {
            on_face: "top" | "bottom" | "left" | "right" | "front" | "back";
          }
        | {
            /**
             * @minItems 3
             * @maxItems 3
             */
            near_mm: [number, number, number];
            within_mm: number;
          }
      )
    ]
  | [
      (
        | {
            parallel: "X" | "Y" | "Z";
          }
        | {
            on_face: "top" | "bottom" | "left" | "right" | "front" | "back";
          }
        | {
            /**
             * @minItems 3
             * @maxItems 3
             */
            near_mm: [number, number, number];
            within_mm: number;
          }
      ),
      (
        | {
            parallel: "X" | "Y" | "Z";
          }
        | {
            on_face: "top" | "bottom" | "left" | "right" | "front" | "back";
          }
        | {
            /**
             * @minItems 3
             * @maxItems 3
             */
            near_mm: [number, number, number];
            within_mm: number;
          }
      ),
      (
        | {
            parallel: "X" | "Y" | "Z";
          }
        | {
            on_face: "top" | "bottom" | "left" | "right" | "front" | "back";
          }
        | {
            /**
             * @minItems 3
             * @maxItems 3
             */
            near_mm: [number, number, number];
            within_mm: number;
          }
      ),
      (
        | {
            parallel: "X" | "Y" | "Z";
          }
        | {
            on_face: "top" | "bottom" | "left" | "right" | "front" | "back";
          }
        | {
            /**
             * @minItems 3
             * @maxItems 3
             */
            near_mm: [number, number, number];
            within_mm: number;
          }
      ),
      (
        | {
            parallel: "X" | "Y" | "Z";
          }
        | {
            on_face: "top" | "bottom" | "left" | "right" | "front" | "back";
          }
        | {
            /**
             * @minItems 3
             * @maxItems 3
             */
            near_mm: [number, number, number];
            within_mm: number;
          }
      ),
      (
        | {
            parallel: "X" | "Y" | "Z";
          }
        | {
            on_face: "top" | "bottom" | "left" | "right" | "front" | "back";
          }
        | {
            /**
             * @minItems 3
             * @maxItems 3
             */
            near_mm: [number, number, number];
            within_mm: number;
          }
      ),
      (
        | {
            parallel: "X" | "Y" | "Z";
          }
        | {
            on_face: "top" | "bottom" | "left" | "right" | "front" | "back";
          }
        | {
            /**
             * @minItems 3
             * @maxItems 3
             */
            near_mm: [number, number, number];
            within_mm: number;
          }
      ),
      (
        | {
            parallel: "X" | "Y" | "Z";
          }
        | {
            on_face: "top" | "bottom" | "left" | "right" | "front" | "back";
          }
        | {
            /**
             * @minItems 3
             * @maxItems 3
             */
            near_mm: [number, number, number];
            within_mm: number;
          }
      ),
      (
        | {
            parallel: "X" | "Y" | "Z";
          }
        | {
            on_face: "top" | "bottom" | "left" | "right" | "front" | "back";
          }
        | {
            /**
             * @minItems 3
             * @maxItems 3
             */
            near_mm: [number, number, number];
            within_mm: number;
          }
      ),
      (
        | {
            parallel: "X" | "Y" | "Z";
          }
        | {
            on_face: "top" | "bottom" | "left" | "right" | "front" | "back";
          }
        | {
            /**
             * @minItems 3
             * @maxItems 3
             */
            near_mm: [number, number, number];
            within_mm: number;
          }
      ),
      (
        | {
            parallel: "X" | "Y" | "Z";
          }
        | {
            on_face: "top" | "bottom" | "left" | "right" | "front" | "back";
          }
        | {
            /**
             * @minItems 3
             * @maxItems 3
             */
            near_mm: [number, number, number];
            within_mm: number;
          }
      ),
      (
        | {
            parallel: "X" | "Y" | "Z";
          }
        | {
            on_face: "top" | "bottom" | "left" | "right" | "front" | "back";
          }
        | {
            /**
             * @minItems 3
             * @maxItems 3
             */
            near_mm: [number, number, number];
            within_mm: number;
          }
      ),
      (
        | {
            parallel: "X" | "Y" | "Z";
          }
        | {
            on_face: "top" | "bottom" | "left" | "right" | "front" | "back";
          }
        | {
            /**
             * @minItems 3
             * @maxItems 3
             */
            near_mm: [number, number, number];
            within_mm: number;
          }
      ),
      (
        | {
            parallel: "X" | "Y" | "Z";
          }
        | {
            on_face: "top" | "bottom" | "left" | "right" | "front" | "back";
          }
        | {
            /**
             * @minItems 3
             * @maxItems 3
             */
            near_mm: [number, number, number];
            within_mm: number;
          }
      ),
      (
        | {
            parallel: "X" | "Y" | "Z";
          }
        | {
            on_face: "top" | "bottom" | "left" | "right" | "front" | "back";
          }
        | {
            /**
             * @minItems 3
             * @maxItems 3
             */
            near_mm: [number, number, number];
            within_mm: number;
          }
      )
    ]
  | [
      (
        | {
            parallel: "X" | "Y" | "Z";
          }
        | {
            on_face: "top" | "bottom" | "left" | "right" | "front" | "back";
          }
        | {
            /**
             * @minItems 3
             * @maxItems 3
             */
            near_mm: [number, number, number];
            within_mm: number;
          }
      ),
      (
        | {
            parallel: "X" | "Y" | "Z";
          }
        | {
            on_face: "top" | "bottom" | "left" | "right" | "front" | "back";
          }
        | {
            /**
             * @minItems 3
             * @maxItems 3
             */
            near_mm: [number, number, number];
            within_mm: number;
          }
      ),
      (
        | {
            parallel: "X" | "Y" | "Z";
          }
        | {
            on_face: "top" | "bottom" | "left" | "right" | "front" | "back";
          }
        | {
            /**
             * @minItems 3
             * @maxItems 3
             */
            near_mm: [number, number, number];
            within_mm: number;
          }
      ),
      (
        | {
            parallel: "X" | "Y" | "Z";
          }
        | {
            on_face: "top" | "bottom" | "left" | "right" | "front" | "back";
          }
        | {
            /**
             * @minItems 3
             * @maxItems 3
             */
            near_mm: [number, number, number];
            within_mm: number;
          }
      ),
      (
        | {
            parallel: "X" | "Y" | "Z";
          }
        | {
            on_face: "top" | "bottom" | "left" | "right" | "front" | "back";
          }
        | {
            /**
             * @minItems 3
             * @maxItems 3
             */
            near_mm: [number, number, number];
            within_mm: number;
          }
      ),
      (
        | {
            parallel: "X" | "Y" | "Z";
          }
        | {
            on_face: "top" | "bottom" | "left" | "right" | "front" | "back";
          }
        | {
            /**
             * @minItems 3
             * @maxItems 3
             */
            near_mm: [number, number, number];
            within_mm: number;
          }
      ),
      (
        | {
            parallel: "X" | "Y" | "Z";
          }
        | {
            on_face: "top" | "bottom" | "left" | "right" | "front" | "back";
          }
        | {
            /**
             * @minItems 3
             * @maxItems 3
             */
            near_mm: [number, number, number];
            within_mm: number;
          }
      ),
      (
        | {
            parallel: "X" | "Y" | "Z";
          }
        | {
            on_face: "top" | "bottom" | "left" | "right" | "front" | "back";
          }
        | {
            /**
             * @minItems 3
             * @maxItems 3
             */
            near_mm: [number, number, number];
            within_mm: number;
          }
      ),
      (
        | {
            parallel: "X" | "Y" | "Z";
          }
        | {
            on_face: "top" | "bottom" | "left" | "right" | "front" | "back";
          }
        | {
            /**
             * @minItems 3
             * @maxItems 3
             */
            near_mm: [number, number, number];
            within_mm: number;
          }
      ),
      (
        | {
            parallel: "X" | "Y" | "Z";
          }
        | {
            on_face: "top" | "bottom" | "left" | "right" | "front" | "back";
          }
        | {
            /**
             * @minItems 3
             * @maxItems 3
             */
            near_mm: [number, number, number];
            within_mm: number;
          }
      ),
      (
        | {
            parallel: "X" | "Y" | "Z";
          }
        | {
            on_face: "top" | "bottom" | "left" | "right" | "front" | "back";
          }
        | {
            /**
             * @minItems 3
             * @maxItems 3
             */
            near_mm: [number, number, number];
            within_mm: number;
          }
      ),
      (
        | {
            parallel: "X" | "Y" | "Z";
          }
        | {
            on_face: "top" | "bottom" | "left" | "right" | "front" | "back";
          }
        | {
            /**
             * @minItems 3
             * @maxItems 3
             */
            near_mm: [number, number, number];
            within_mm: number;
          }
      ),
      (
        | {
            parallel: "X" | "Y" | "Z";
          }
        | {
            on_face: "top" | "bottom" | "left" | "right" | "front" | "back";
          }
        | {
            /**
             * @minItems 3
             * @maxItems 3
             */
            near_mm: [number, number, number];
            within_mm: number;
          }
      ),
      (
        | {
            parallel: "X" | "Y" | "Z";
          }
        | {
            on_face: "top" | "bottom" | "left" | "right" | "front" | "back";
          }
        | {
            /**
             * @minItems 3
             * @maxItems 3
             */
            near_mm: [number, number, number];
            within_mm: number;
          }
      ),
      (
        | {
            parallel: "X" | "Y" | "Z";
          }
        | {
            on_face: "top" | "bottom" | "left" | "right" | "front" | "back";
          }
        | {
            /**
             * @minItems 3
             * @maxItems 3
             */
            near_mm: [number, number, number];
            within_mm: number;
          }
      ),
      (
        | {
            parallel: "X" | "Y" | "Z";
          }
        | {
            on_face: "top" | "bottom" | "left" | "right" | "front" | "back";
          }
        | {
            /**
             * @minItems 3
             * @maxItems 3
             */
            near_mm: [number, number, number];
            within_mm: number;
          }
      )
    ];

/**
 * Part Spec v4.3 (v4.2 plus draft angle, and CAD features that can use plates, bodies, tubes, reducers, volutes and merges). 'draft' leans faces of a solid away from a neutral plane, as a moulded or cast part needs. Booleans, fillets, patterns, hollow, mirror and the other CAD features can name any plate, body, tube, reducer, volute or merge by id as a solid; one they use up is no longer part of the result. Everything from v4.2 still works. All lengths are in millimeters and all angles in degrees.
 */
export interface PartSpecV4_3 {
  spec_version: "4.3";
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
 * A solid with a height, for boxes, vases, cups and knobs. The body frame has its origin at the center of the base, Z up, so the base sits at Z = 0 and the top at Z = height_mm. 'shape' says how it is made; 'shell' hollows it; 'edge_fillet_mm' rounds the outer top and bottom edges, or use edge_fillet_top_mm and edge_fillet_bottom_mm to round them separately; 'bores' drills blind holes; 'texture' adds vertical ridges or grooves on the outside wall.
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
  /**
   * Radius that rounds only the outer top edge. Cannot be combined with edge_fillet_mm.
   */
  edge_fillet_top_mm?: number;
  /**
   * Radius that rounds only the outer bottom edge. Cannot be combined with edge_fillet_mm.
   */
  edge_fillet_bottom_mm?: number;
  /**
   * Blind holes drilled into the body, such as the socket of a shift knob.
   *
   * @minItems 1
   * @maxItems 8
   */
  bores?:
    | [Bore]
    | [Bore, Bore]
    | [Bore, Bore, Bore]
    | [Bore, Bore, Bore, Bore]
    | [Bore, Bore, Bore, Bore, Bore]
    | [Bore, Bore, Bore, Bore, Bore, Bore]
    | [Bore, Bore, Bore, Bore, Bore, Bore, Bore]
    | [Bore, Bore, Bore, Bore, Bore, Bore, Bore, Bore];
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
/**
 * A round hole drilled into a body along its Z axis and stopping at depth_mm (a blind bore). from 'bottom' drills up from the base face and 'top' drills down from the top face. position_mm is [x, y] from the body's center, default [0, 0]. For a threaded hole, use the tap-drill diameter (8.8 mm for M10x1.25), not the thread's outer diameter.
 */
export interface Bore {
  diameter_mm: LengthMm;
  depth_mm: LengthMm;
  from: "bottom" | "top";
  position_mm?: PointMm;
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
/**
 * A round pipe swept along a 3D path. 'path_mm' lists [x, y, z] corner points in the part frame (relative to 'placement'); each corner between two straight runs is rounded with 'bend_radius_mm' (the centerline radius, default 1.5 times the outer diameter). 'wall_thickness_mm' makes it hollow with open ends; leave it out for a solid rod. The ends are cut square to the first and last run.
 */
export interface Tube {
  id: Id;
  type: "tube";
  /**
   * @minItems 2
   * @maxItems 64
   */
  path_mm: [[number, number, number], [number, number, number], ...[number, number, number][]];
  outer_diameter_mm: number;
  wall_thickness_mm?: number;
  bend_radius_mm?: number;
  placement: Placement;
}
/**
 * Fuses two or more tubes that overlap into one solid, then clears every tube's bore so the passages join (a collector where runners meet). The merged tubes are not built separately. A tube can be in only one merge.
 */
export interface Merge {
  id: Id;
  type: "merge";
  /**
   * @minItems 2
   * @maxItems 16
   */
  tubes:
    | [Id, Id]
    | [Id, Id, Id]
    | [Id, Id, Id, Id]
    | [Id, Id, Id, Id, Id]
    | [Id, Id, Id, Id, Id, Id]
    | [Id, Id, Id, Id, Id, Id, Id]
    | [Id, Id, Id, Id, Id, Id, Id, Id]
    | [Id, Id, Id, Id, Id, Id, Id, Id, Id]
    | [Id, Id, Id, Id, Id, Id, Id, Id, Id, Id]
    | [Id, Id, Id, Id, Id, Id, Id, Id, Id, Id, Id]
    | [Id, Id, Id, Id, Id, Id, Id, Id, Id, Id, Id, Id]
    | [Id, Id, Id, Id, Id, Id, Id, Id, Id, Id, Id, Id, Id]
    | [Id, Id, Id, Id, Id, Id, Id, Id, Id, Id, Id, Id, Id, Id]
    | [Id, Id, Id, Id, Id, Id, Id, Id, Id, Id, Id, Id, Id, Id, Id]
    | [Id, Id, Id, Id, Id, Id, Id, Id, Id, Id, Id, Id, Id, Id, Id, Id];
}
/**
 * A straight pipe whose outer diameter changes linearly from 'start_diameter_mm' at 'start_mm' to 'end_diameter_mm' at 'end_mm' (points in the part frame, relative to 'placement'). 'wall_thickness_mm' makes it hollow with open ends. It can join a merge like a tube.
 */
export interface Reducer {
  id: Id;
  type: "reducer";
  /**
   * @minItems 3
   * @maxItems 3
   */
  start_mm: [number, number, number];
  /**
   * @minItems 3
   * @maxItems 3
   */
  end_mm: [number, number, number];
  start_diameter_mm: number;
  end_diameter_mm: number;
  wall_thickness_mm?: number;
  placement: Placement;
}
/**
 * A bolted end plate on one end of a hollow tube or reducer ('tube' is its id, 'end' is 'start' or 'end' of the path). The flange face is flush with the pipe's open end and the plate extends back along the pipe by 'thickness_mm'. The pipe bore runs through it. Bolt holes are placed in the flange frame: origin on the pipe axis, X and Y in the face seen from outside, X chosen as the world Z axis crossed with the outward direction (world X if the pipe points along Z). On a volute the ends are 'inlet' (the straight inlet stub) and 'outlet' (the axial exhaust outlet).
 */
export interface Flange {
  id: Id;
  type: "flange";
  tube: Id;
  end: "start" | "end" | "inlet" | "outlet";
  outline:
    | {
        kind: "circle";
        diameter_mm: number;
      }
    | {
        kind: "rectangle";
        width_mm: number;
        length_mm: number;
      };
  thickness_mm: number;
  bolt_holes?: {
    hole_diameter_mm: number;
    pattern:
      | {
          kind: "circular";
          count: number;
          circle_diameter_mm: number;
          start_angle_deg?: number;
        }
      | {
          kind: "points";
          /**
           * @minItems 1
           * @maxItems 32
           */
          points_mm: [PointMm, ...PointMm[]];
        };
  };
}
/**
 * A turbine-style scroll housing (turbo exhaust housing). Frame: origin on the wheel axis at the wheel plane, Z along the axis, outlet towards -Z. The passage starts at the tongue on the +X axis and winds counter-clockwise seen from +Z; its round section area grows linearly with angle and is sized so the largest section has the given 'a_over_r_cm' (area in cm2 over centroid radius in cm, as vendors quote A/R). Its inner edge opens onto the wheel cavity (inducer diameter plus clearance). The inlet is a straight stub of the largest section on the +X side, centered at x = cavity radius + largest section radius, flowing +Y and entering from -Y. The outlet is a cone down to the exducer bore. Walls are 'wall_thickness_mm' all round. Simplified: no wastegate, bearing flange or vanes.
 */
export interface Volute {
  id: Id;
  type: "volute";
  inducer_diameter_mm: number;
  exducer_diameter_mm: number;
  a_over_r_cm: number;
  wall_thickness_mm: number;
  tongue_clearance_mm?: number;
  inlet_length_mm?: number;
  outlet_length_mm?: number;
  placement: Placement;
}
/**
 * 2D shapes on a plane. 'plane' is 'XY' (x right, y up the sketch, normal +Z), 'XZ' (x = world X, y = world Z, normal -Y) or 'YZ' (x = world Y, y = world Z, normal +X), moved 'offset_mm' along its normal and/or to 'origin_mm' in the part frame. Each shape is an 'outer' outline with optional 'holes' (outlines inside it).
 */
export interface Sketch {
  id: Id;
  type: "sketch";
  plane: {
    name: "XY" | "XZ" | "YZ";
    offset_mm?: number;
    /**
     * @minItems 3
     * @maxItems 3
     */
    origin_mm?: [number, number, number];
  };
  /**
   * @minItems 1
   * @maxItems 32
   */
  shapes: [
    {
      outer: SketchLoop;
      /**
       * @minItems 1
       * @maxItems 64
       */
      holes?: [SketchLoop, ...SketchLoop[]];
    },
    ...{
      outer: SketchLoop;
      /**
       * @minItems 1
       * @maxItems 64
       */
      holes?: [SketchLoop, ...SketchLoop[]];
    }[]
  ];
}
/**
 * Pushes a sketch into a solid. 'distance_mm' is the length; 'direction' is 'normal' (along the plane normal, default), 'reverse' or 'symmetric' (half each way); 'taper_deg' leans the sides in (positive) or out. 'operation' 'new' (default) makes a solid named by this feature's id; 'add', 'cut' and 'intersect' combine the result with the solid named by 'target', and the combined solid takes this feature's id.
 */
export interface ExtrudeFeature {
  id: Id;
  type: "extrude";
  sketch: Id;
  distance_mm: number;
  direction?: "normal" | "reverse" | "symmetric";
  taper_deg?: number;
  operation?: "new" | "add" | "cut" | "intersect";
  target?: Id;
}
/**
 * Spins a sketch about an axis in the sketch plane into a solid. 'axis' is a line from 'from_mm' to 'to_mm' in sketch coordinates (default: the sketch's y axis); the sketch must stay on one side of it. 'angle_deg' is the sweep (default 360). 'operation' and 'target' work as for extrude.
 */
export interface RevolveFeature {
  id: Id;
  type: "revolve";
  sketch: Id;
  axis?: {
    from_mm: SketchPoint;
    to_mm: SketchPoint;
  };
  angle_deg?: number;
  operation?: "new" | "add" | "cut" | "intersect";
  target?: Id;
}
/**
 * Combines solids: 'union' joins 'target' and every tool, 'cut' removes the tools from the target, 'intersect' keeps only the shared volume. The target and tools are used up; the result takes this feature's id.
 */
export interface Boolean {
  id: Id;
  type: "boolean";
  operation: "union" | "cut" | "intersect";
  target: Id;
  /**
   * @minItems 1
   * @maxItems 32
   */
  tools: [Id, ...Id[]];
}
/**
 * Moves a solid. Steps run in this order: 'mirror' across a plane ('XY', 'XZ' or 'YZ' of the part frame, moved 'offset_mm' along its normal), then 'rotate' about an axis through 'axis_point_mm' with direction 'axis_dir', then 'translate_mm'. The result takes this feature's id. With 'copy' true the source solid stays too (use it to repeat a shape); otherwise the source is used up.
 */
export interface Transform {
  id: Id;
  type: "transform";
  source: Id;
  /**
   * @minItems 3
   * @maxItems 3
   */
  translate_mm?: [number, number, number];
  rotate?: {
    /**
     * @minItems 3
     * @maxItems 3
     */
    axis_point_mm: [number, number, number];
    /**
     * @minItems 3
     * @maxItems 3
     */
    axis_dir: [number, number, number];
    angle_deg: number;
  };
  mirror?: {
    plane: "XY" | "XZ" | "YZ";
    offset_mm?: number;
  };
  copy?: boolean;
}
/**
 * An open path on a plane (same planes as a sketch), for 'sweep' to follow. Starts at 'start_mm' and continues through line, 3-point arc and spline segments.
 */
export interface Curve {
  id: Id;
  type: "curve";
  plane: {
    name: "XY" | "XZ" | "YZ";
    offset_mm?: number;
    /**
     * @minItems 3
     * @maxItems 3
     */
    origin_mm?: [number, number, number];
  };
  start_mm: SketchPoint;
  /**
   * @minItems 1
   * @maxItems 256
   */
  segments: [
    (
      | {
          kind: "line";
          to_mm: SketchPoint;
        }
      | {
          kind: "arc";
          mid_mm: SketchPoint;
          to_mm: SketchPoint;
        }
      | {
          kind: "spline";
          /**
           * @minItems 2
           * @maxItems 64
           */
          through_mm: [SketchPoint, SketchPoint, ...SketchPoint[]];
        }
    ),
    ...(
      | {
          kind: "line";
          to_mm: SketchPoint;
        }
      | {
          kind: "arc";
          mid_mm: SketchPoint;
          to_mm: SketchPoint;
        }
      | {
          kind: "spline";
          /**
           * @minItems 2
           * @maxItems 64
           */
          through_mm: [SketchPoint, SketchPoint, ...SketchPoint[]];
        }
    )[]
  ];
}
/**
 * Drags the first outline of sketch 'profile' along curve 'path' to make a solid. The profile's plane should pass through the curve's start and face along it. 'operation' and 'target' work as for extrude.
 */
export interface Sweep {
  id: Id;
  type: "sweep";
  profile: Id;
  path: Id;
  operation?: "new" | "add" | "cut" | "intersect";
  target?: Id;
}
/**
 * Blends a solid through two or more sketches in the order listed (each sketch holds one outline, no holes). 'ruled' joins them with straight faces instead of a smooth blend. 'operation' and 'target' work as for extrude.
 */
export interface Loft {
  id: Id;
  type: "loft";
  /**
   * @minItems 2
   * @maxItems 16
   */
  sketches:
    | [Id, Id]
    | [Id, Id, Id]
    | [Id, Id, Id, Id]
    | [Id, Id, Id, Id, Id]
    | [Id, Id, Id, Id, Id, Id]
    | [Id, Id, Id, Id, Id, Id, Id]
    | [Id, Id, Id, Id, Id, Id, Id, Id]
    | [Id, Id, Id, Id, Id, Id, Id, Id, Id]
    | [Id, Id, Id, Id, Id, Id, Id, Id, Id, Id]
    | [Id, Id, Id, Id, Id, Id, Id, Id, Id, Id, Id]
    | [Id, Id, Id, Id, Id, Id, Id, Id, Id, Id, Id, Id]
    | [Id, Id, Id, Id, Id, Id, Id, Id, Id, Id, Id, Id, Id]
    | [Id, Id, Id, Id, Id, Id, Id, Id, Id, Id, Id, Id, Id, Id]
    | [Id, Id, Id, Id, Id, Id, Id, Id, Id, Id, Id, Id, Id, Id, Id]
    | [Id, Id, Id, Id, Id, Id, Id, Id, Id, Id, Id, Id, Id, Id, Id, Id];
  ruled?: boolean;
  operation?: "new" | "add" | "cut" | "intersect";
  target?: Id;
}
/**
 * Rounds chosen edges of the solid named 'solid'. The solid is used up; the result takes this feature's id.
 */
export interface FilletEdges {
  id: Id;
  type: "fillet_edges";
  solid: Id;
  edges: EdgeSelector;
  radius_mm: number;
}
/**
 * Bevels chosen edges of the solid named 'solid'. The solid is used up; the result takes this feature's id.
 */
export interface ChamferEdges {
  id: Id;
  type: "chamfer_edges";
  solid: Id;
  edges: EdgeSelector;
  distance_mm: number;
}
/**
 * Makes the solid 'solid' thin-walled with wall 'thickness_mm', growing inward. 'open_sides' removes those sides (top +Z, bottom -Z, right +X, left -X, back +Y, front -Y) so the part becomes a cup or tray; with none, it is a closed hollow. The solid is used up; the result takes this feature's id.
 */
export interface Hollow {
  id: Id;
  type: "hollow";
  solid: Id;
  thickness_mm: number;
  /**
   * @minItems 1
   * @maxItems 6
   */
  open_sides?:
    | ["top" | "bottom" | "left" | "right" | "front" | "back"]
    | ["top" | "bottom" | "left" | "right" | "front" | "back", "top" | "bottom" | "left" | "right" | "front" | "back"]
    | [
        "top" | "bottom" | "left" | "right" | "front" | "back",
        "top" | "bottom" | "left" | "right" | "front" | "back",
        "top" | "bottom" | "left" | "right" | "front" | "back"
      ]
    | [
        "top" | "bottom" | "left" | "right" | "front" | "back",
        "top" | "bottom" | "left" | "right" | "front" | "back",
        "top" | "bottom" | "left" | "right" | "front" | "back",
        "top" | "bottom" | "left" | "right" | "front" | "back"
      ]
    | [
        "top" | "bottom" | "left" | "right" | "front" | "back",
        "top" | "bottom" | "left" | "right" | "front" | "back",
        "top" | "bottom" | "left" | "right" | "front" | "back",
        "top" | "bottom" | "left" | "right" | "front" | "back",
        "top" | "bottom" | "left" | "right" | "front" | "back"
      ]
    | [
        "top" | "bottom" | "left" | "right" | "front" | "back",
        "top" | "bottom" | "left" | "right" | "front" | "back",
        "top" | "bottom" | "left" | "right" | "front" | "back",
        "top" | "bottom" | "left" | "right" | "front" | "back",
        "top" | "bottom" | "left" | "right" | "front" | "back",
        "top" | "bottom" | "left" | "right" | "front" | "back"
      ];
}
/**
 * Repeats the solid 'source' 'count' times, each copy 'spacing_mm' [x,y,z] further along than the last, and joins them into one solid (copies must touch or be tools for a cut). The source is used up; the result takes this feature's id.
 */
export interface LinearPattern {
  id: Id;
  type: "linear_pattern";
  source: Id;
  count: number;
  /**
   * @minItems 3
   * @maxItems 3
   */
  spacing_mm: [number, number, number];
}
/**
 * Repeats the solid 'source' 'count' times around an axis through 'axis_point_mm' along 'axis_dir', spread over 'angle_deg' (default 360, evenly around; a smaller angle puts the first and last copies that far apart). Copies are joined into one solid.
 */
export interface CircularPattern {
  id: Id;
  type: "circular_pattern";
  source: Id;
  count: number;
  /**
   * @minItems 3
   * @maxItems 3
   */
  axis_point_mm: [number, number, number];
  /**
   * @minItems 3
   * @maxItems 3
   */
  axis_dir: [number, number, number];
  angle_deg?: number;
}
/**
 * Adds a mirrored copy of 'source' across plane 'plane' ('XY', 'XZ' or 'YZ', moved 'offset_mm'), joined to the original. The source is used up; the result takes this feature's id. (To keep them as two separate solids use 'transform' with mirror and copy.)
 */
export interface Mirror {
  id: Id;
  type: "mirror";
  source: Id;
  plane: "XY" | "XZ" | "YZ";
  offset_mm?: number;
}
/**
 * Leans faces of 'solid' by 'angle_deg' (0.1 to 30), as a mould needs so the part can be pulled out. The neutral plane is at the bottom of the part along 'pull_direction' ('X', 'Y' or 'Z', default 'Z'), or at the top with neutral 'top'; faces stay put there and lean inward as they get further away (a positive angle makes the part narrower away from the neutral plane). 'faces' is 'sides' (every face except flat ones facing along the pull direction) or a list of sides (top, bottom, left, right, front, back) naming the outermost face on that side. The solid is used up; the result takes this feature's id.
 */
export interface Draft {
  id: Id;
  type: "draft";
  solid: Id;
  angle_deg: number;
  pull_direction?: "X" | "Y" | "Z";
  neutral?: "bottom" | "top";
  faces:
    | "sides"
    | ["top" | "bottom" | "left" | "right" | "front" | "back"]
    | ["top" | "bottom" | "left" | "right" | "front" | "back", "top" | "bottom" | "left" | "right" | "front" | "back"]
    | [
        "top" | "bottom" | "left" | "right" | "front" | "back",
        "top" | "bottom" | "left" | "right" | "front" | "back",
        "top" | "bottom" | "left" | "right" | "front" | "back"
      ]
    | [
        "top" | "bottom" | "left" | "right" | "front" | "back",
        "top" | "bottom" | "left" | "right" | "front" | "back",
        "top" | "bottom" | "left" | "right" | "front" | "back",
        "top" | "bottom" | "left" | "right" | "front" | "back"
      ]
    | [
        "top" | "bottom" | "left" | "right" | "front" | "back",
        "top" | "bottom" | "left" | "right" | "front" | "back",
        "top" | "bottom" | "left" | "right" | "front" | "back",
        "top" | "bottom" | "left" | "right" | "front" | "back",
        "top" | "bottom" | "left" | "right" | "front" | "back"
      ]
    | [
        "top" | "bottom" | "left" | "right" | "front" | "back",
        "top" | "bottom" | "left" | "right" | "front" | "back",
        "top" | "bottom" | "left" | "right" | "front" | "back",
        "top" | "bottom" | "left" | "right" | "front" | "back",
        "top" | "bottom" | "left" | "right" | "front" | "back",
        "top" | "bottom" | "left" | "right" | "front" | "back"
      ];
}
