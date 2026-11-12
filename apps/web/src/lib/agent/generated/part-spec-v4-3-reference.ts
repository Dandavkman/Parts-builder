/* Generated from services/geometry/src/geometry/spec (part-spec.v4_3.schema.json and examples). Do not edit. Run `pnpm generate`. */
export const PART_SPEC_V4_3_SCHEMA: Record<string, unknown> = {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://parts-builder.local/schemas/part-spec.v4_3.json",
  "title": "PartSpecV4_3",
  "description": "Part Spec v4.3 (v4.2 plus draft angle, and CAD features that can use plates, bodies, tubes, reducers, volutes and merges). 'draft' leans faces of a solid away from a neutral plane, as a moulded or cast part needs. Booleans, fillets, patterns, hollow, mirror and the other CAD features can name any plate, body, tube, reducer, volute or merge by id as a solid; one they use up is no longer part of the result. Everything from v4.2 still works. All lengths are in millimeters and all angles in degrees.",
  "type": "object",
  "additionalProperties": false,
  "required": [
    "spec_version",
    "name",
    "features"
  ],
  "properties": {
    "spec_version": {
      "const": "4.3"
    },
    "name": {
      "type": "string",
      "minLength": 1,
      "maxLength": 120
    },
    "features": {
      "type": "array",
      "minItems": 1,
      "maxItems": 200,
      "items": {
        "$ref": "#/$defs/feature"
      }
    }
  },
  "$defs": {
    "id": {
      "description": "Unique feature id within the spec, referenced by other features.",
      "type": "string",
      "pattern": "^[a-z][a-z0-9_]{0,39}$"
    },
    "length_mm": {
      "type": "number",
      "exclusiveMinimum": 0,
      "maximum": 2000
    },
    "angle_deg": {
      "type": "number",
      "minimum": -360,
      "maximum": 360
    },
    "point_mm": {
      "description": "A point [x, y] in millimeters. In a plate or extrude outline it is in the plate's local frame, origin at the center. In a revolve profile it is [radius, z] from the axis and the base.",
      "type": "array",
      "minItems": 2,
      "maxItems": 2,
      "items": {
        "type": "number"
      }
    },
    "placement": {
      "description": "Where a feature sits. 'anchor' is an anchor id picked on the scan, or 'origin' for the part's own local origin. Offsets are relative to that anchor, never absolute. Rotation is about the anchor's normal or axis.",
      "type": "object",
      "additionalProperties": false,
      "required": [
        "anchor"
      ],
      "properties": {
        "anchor": {
          "type": "string",
          "minLength": 1,
          "maxLength": 64
        },
        "offset_mm": {
          "type": "array",
          "minItems": 3,
          "maxItems": 3,
          "default": [
            0,
            0,
            0
          ],
          "items": {
            "type": "number"
          }
        },
        "rotation_deg": {
          "$ref": "#/$defs/angle_deg",
          "default": 0
        }
      }
    },
    "feature": {
      "oneOf": [
        {
          "$ref": "#/$defs/plate"
        },
        {
          "$ref": "#/$defs/body"
        },
        {
          "$ref": "#/$defs/hole"
        },
        {
          "$ref": "#/$defs/hole_pattern"
        },
        {
          "$ref": "#/$defs/counterbore"
        },
        {
          "$ref": "#/$defs/countersink"
        },
        {
          "$ref": "#/$defs/slot"
        },
        {
          "$ref": "#/$defs/standoff"
        },
        {
          "$ref": "#/$defs/rib"
        },
        {
          "$ref": "#/$defs/bend"
        },
        {
          "$ref": "#/$defs/fillet"
        },
        {
          "$ref": "#/$defs/chamfer"
        },
        {
          "$ref": "#/$defs/cutout"
        },
        {
          "$ref": "#/$defs/emboss_text"
        },
        {
          "$ref": "#/$defs/tube"
        },
        {
          "$ref": "#/$defs/merge"
        },
        {
          "$ref": "#/$defs/reducer"
        },
        {
          "$ref": "#/$defs/flange"
        },
        {
          "$ref": "#/$defs/volute"
        },
        {
          "$ref": "#/$defs/sketch"
        },
        {
          "$ref": "#/$defs/extrude_feature"
        },
        {
          "$ref": "#/$defs/revolve_feature"
        },
        {
          "$ref": "#/$defs/boolean"
        },
        {
          "$ref": "#/$defs/transform"
        },
        {
          "$ref": "#/$defs/curve"
        },
        {
          "$ref": "#/$defs/sweep"
        },
        {
          "$ref": "#/$defs/loft"
        },
        {
          "$ref": "#/$defs/fillet_edges"
        },
        {
          "$ref": "#/$defs/chamfer_edges"
        },
        {
          "$ref": "#/$defs/hollow"
        },
        {
          "$ref": "#/$defs/linear_pattern"
        },
        {
          "$ref": "#/$defs/circular_pattern"
        },
        {
          "$ref": "#/$defs/mirror"
        },
        {
          "$ref": "#/$defs/draft"
        }
      ]
    },
    "plate": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "id",
        "type",
        "outline",
        "thickness_mm",
        "placement"
      ],
      "properties": {
        "id": {
          "$ref": "#/$defs/id"
        },
        "type": {
          "const": "plate"
        },
        "outline": {
          "$ref": "#/$defs/outline"
        },
        "thickness_mm": {
          "$ref": "#/$defs/length_mm"
        },
        "placement": {
          "$ref": "#/$defs/placement"
        }
      }
    },
    "hole": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "id",
        "type",
        "plate",
        "diameter_mm",
        "position_mm"
      ],
      "properties": {
        "id": {
          "$ref": "#/$defs/id"
        },
        "type": {
          "const": "hole"
        },
        "plate": {
          "$ref": "#/$defs/id"
        },
        "diameter_mm": {
          "$ref": "#/$defs/length_mm"
        },
        "position_mm": {
          "$ref": "#/$defs/point_mm"
        }
      }
    },
    "hole_pattern": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "id",
        "type",
        "plate",
        "diameter_mm",
        "pattern"
      ],
      "properties": {
        "id": {
          "$ref": "#/$defs/id"
        },
        "type": {
          "const": "hole_pattern"
        },
        "plate": {
          "$ref": "#/$defs/id"
        },
        "diameter_mm": {
          "$ref": "#/$defs/length_mm"
        },
        "pattern": {
          "oneOf": [
            {
              "type": "object",
              "additionalProperties": false,
              "required": [
                "kind",
                "count_x",
                "count_y",
                "spacing_x_mm",
                "spacing_y_mm"
              ],
              "properties": {
                "kind": {
                  "const": "rectangular"
                },
                "center_mm": {
                  "$ref": "#/$defs/point_mm"
                },
                "count_x": {
                  "type": "integer",
                  "minimum": 1,
                  "maximum": 50
                },
                "count_y": {
                  "type": "integer",
                  "minimum": 1,
                  "maximum": 50
                },
                "spacing_x_mm": {
                  "$ref": "#/$defs/length_mm"
                },
                "spacing_y_mm": {
                  "$ref": "#/$defs/length_mm"
                }
              }
            },
            {
              "type": "object",
              "additionalProperties": false,
              "required": [
                "kind",
                "count",
                "radius_mm"
              ],
              "properties": {
                "kind": {
                  "const": "circular"
                },
                "center_mm": {
                  "$ref": "#/$defs/point_mm"
                },
                "count": {
                  "type": "integer",
                  "minimum": 2,
                  "maximum": 50
                },
                "radius_mm": {
                  "$ref": "#/$defs/length_mm"
                },
                "start_angle_deg": {
                  "type": "number",
                  "default": 0
                }
              }
            }
          ]
        }
      }
    },
    "counterbore": {
      "description": "A through hole with a flat-bottomed recess on the top face, for a bolt head.",
      "type": "object",
      "additionalProperties": false,
      "required": [
        "id",
        "type",
        "plate",
        "position_mm",
        "diameter_mm",
        "bore_diameter_mm",
        "bore_depth_mm"
      ],
      "properties": {
        "id": {
          "$ref": "#/$defs/id"
        },
        "type": {
          "const": "counterbore"
        },
        "plate": {
          "$ref": "#/$defs/id"
        },
        "position_mm": {
          "$ref": "#/$defs/point_mm"
        },
        "diameter_mm": {
          "$ref": "#/$defs/length_mm"
        },
        "bore_diameter_mm": {
          "$ref": "#/$defs/length_mm"
        },
        "bore_depth_mm": {
          "$ref": "#/$defs/length_mm"
        }
      }
    },
    "countersink": {
      "description": "A through hole with a conical recess on the top face, for a flat-head screw.",
      "type": "object",
      "additionalProperties": false,
      "required": [
        "id",
        "type",
        "plate",
        "position_mm",
        "diameter_mm",
        "sink_diameter_mm"
      ],
      "properties": {
        "id": {
          "$ref": "#/$defs/id"
        },
        "type": {
          "const": "countersink"
        },
        "plate": {
          "$ref": "#/$defs/id"
        },
        "position_mm": {
          "$ref": "#/$defs/point_mm"
        },
        "diameter_mm": {
          "$ref": "#/$defs/length_mm"
        },
        "sink_diameter_mm": {
          "$ref": "#/$defs/length_mm"
        },
        "sink_angle_deg": {
          "type": "number",
          "exclusiveMinimum": 0,
          "maximum": 180,
          "default": 90
        }
      }
    },
    "slot": {
      "description": "A through slot with rounded ends. length_mm is end to end.",
      "type": "object",
      "additionalProperties": false,
      "required": [
        "id",
        "type",
        "plate",
        "position_mm",
        "length_mm",
        "width_mm"
      ],
      "properties": {
        "id": {
          "$ref": "#/$defs/id"
        },
        "type": {
          "const": "slot"
        },
        "plate": {
          "$ref": "#/$defs/id"
        },
        "position_mm": {
          "$ref": "#/$defs/point_mm"
        },
        "length_mm": {
          "$ref": "#/$defs/length_mm"
        },
        "width_mm": {
          "$ref": "#/$defs/length_mm"
        },
        "angle_deg": {
          "$ref": "#/$defs/angle_deg",
          "default": 0
        }
      }
    },
    "standoff": {
      "description": "A round post standing on a plate face. A positive hole_diameter_mm drills it through the post and the plate.",
      "type": "object",
      "additionalProperties": false,
      "required": [
        "id",
        "type",
        "plate",
        "position_mm",
        "outer_diameter_mm",
        "height_mm"
      ],
      "properties": {
        "id": {
          "$ref": "#/$defs/id"
        },
        "type": {
          "const": "standoff"
        },
        "plate": {
          "$ref": "#/$defs/id"
        },
        "position_mm": {
          "$ref": "#/$defs/point_mm"
        },
        "outer_diameter_mm": {
          "$ref": "#/$defs/length_mm"
        },
        "height_mm": {
          "$ref": "#/$defs/length_mm"
        },
        "hole_diameter_mm": {
          "$ref": "#/$defs/length_mm"
        },
        "face": {
          "enum": [
            "top",
            "bottom"
          ],
          "default": "top"
        }
      }
    },
    "rib": {
      "description": "A thin wall standing on a plate face along a line. 'rectangular' is a rib of constant height. 'triangular' is a gusset whose height falls from height_mm at start_mm to zero at end_mm.",
      "type": "object",
      "additionalProperties": false,
      "required": [
        "id",
        "type",
        "plate",
        "start_mm",
        "end_mm",
        "thickness_mm",
        "height_mm"
      ],
      "properties": {
        "id": {
          "$ref": "#/$defs/id"
        },
        "type": {
          "const": "rib"
        },
        "plate": {
          "$ref": "#/$defs/id"
        },
        "start_mm": {
          "$ref": "#/$defs/point_mm"
        },
        "end_mm": {
          "$ref": "#/$defs/point_mm"
        },
        "thickness_mm": {
          "$ref": "#/$defs/length_mm"
        },
        "height_mm": {
          "$ref": "#/$defs/length_mm"
        },
        "profile": {
          "enum": [
            "rectangular",
            "triangular"
          ],
          "default": "rectangular"
        },
        "face": {
          "enum": [
            "top",
            "bottom"
          ],
          "default": "top"
        }
      }
    },
    "bend": {
      "description": "Joins an edge of one plate to an edge of another through a rounded bend, making an L or other angled bracket. The second plate's own placement is ignored; the bend positions it.",
      "type": "object",
      "additionalProperties": false,
      "required": [
        "id",
        "type",
        "from_plate",
        "from_edge",
        "to_plate",
        "to_edge",
        "angle_deg",
        "inner_radius_mm"
      ],
      "properties": {
        "id": {
          "$ref": "#/$defs/id"
        },
        "type": {
          "const": "bend"
        },
        "from_plate": {
          "$ref": "#/$defs/id"
        },
        "from_edge": {
          "enum": [
            "+x",
            "-x",
            "+y",
            "-y"
          ]
        },
        "to_plate": {
          "$ref": "#/$defs/id"
        },
        "to_edge": {
          "enum": [
            "+x",
            "-x",
            "+y",
            "-y"
          ]
        },
        "angle_deg": {
          "type": "number",
          "minimum": 1,
          "maximum": 179,
          "default": 90
        },
        "inner_radius_mm": {
          "type": "number",
          "minimum": 0,
          "maximum": 200
        }
      }
    },
    "fillet": {
      "description": "Rounds edges of a plate. 'vertical' is the outline corners, 'top' and 'bottom' are the face outlines, 'all' is every edge.",
      "type": "object",
      "additionalProperties": false,
      "required": [
        "id",
        "type",
        "plate",
        "edges",
        "radius_mm"
      ],
      "properties": {
        "id": {
          "$ref": "#/$defs/id"
        },
        "type": {
          "const": "fillet"
        },
        "plate": {
          "$ref": "#/$defs/id"
        },
        "edges": {
          "enum": [
            "vertical",
            "top",
            "bottom",
            "all"
          ]
        },
        "radius_mm": {
          "$ref": "#/$defs/length_mm"
        }
      }
    },
    "chamfer": {
      "description": "Bevels edges of a plate. Edge selection is the same as for fillet.",
      "type": "object",
      "additionalProperties": false,
      "required": [
        "id",
        "type",
        "plate",
        "edges",
        "distance_mm"
      ],
      "properties": {
        "id": {
          "$ref": "#/$defs/id"
        },
        "type": {
          "const": "chamfer"
        },
        "plate": {
          "$ref": "#/$defs/id"
        },
        "edges": {
          "enum": [
            "vertical",
            "top",
            "bottom",
            "all"
          ]
        },
        "distance_mm": {
          "$ref": "#/$defs/length_mm"
        }
      }
    },
    "cutout": {
      "description": "A through cut around a clearance zone on the scan, such as a bolt head or a hose, positioned by an anchor. margin_mm grows the cut beyond the zone shape.",
      "type": "object",
      "additionalProperties": false,
      "required": [
        "id",
        "type",
        "plate",
        "placement",
        "zone"
      ],
      "properties": {
        "id": {
          "$ref": "#/$defs/id"
        },
        "type": {
          "const": "cutout"
        },
        "plate": {
          "$ref": "#/$defs/id"
        },
        "placement": {
          "$ref": "#/$defs/placement"
        },
        "zone": {
          "oneOf": [
            {
              "type": "object",
              "additionalProperties": false,
              "required": [
                "kind",
                "diameter_mm"
              ],
              "properties": {
                "kind": {
                  "const": "circle"
                },
                "diameter_mm": {
                  "$ref": "#/$defs/length_mm"
                }
              }
            },
            {
              "type": "object",
              "additionalProperties": false,
              "required": [
                "kind",
                "width_mm",
                "length_mm"
              ],
              "properties": {
                "kind": {
                  "const": "rectangle"
                },
                "width_mm": {
                  "$ref": "#/$defs/length_mm"
                },
                "length_mm": {
                  "$ref": "#/$defs/length_mm"
                }
              }
            }
          ]
        },
        "margin_mm": {
          "type": "number",
          "minimum": 0,
          "maximum": 100,
          "default": 0
        }
      }
    },
    "emboss_text": {
      "description": "Text raised from, or engraved into, a plate face. height_mm is the letter height; depth_mm is how far it rises or sinks.",
      "type": "object",
      "additionalProperties": false,
      "required": [
        "id",
        "type",
        "plate",
        "position_mm",
        "text",
        "height_mm",
        "depth_mm"
      ],
      "properties": {
        "id": {
          "$ref": "#/$defs/id"
        },
        "type": {
          "const": "emboss_text"
        },
        "plate": {
          "$ref": "#/$defs/id"
        },
        "position_mm": {
          "$ref": "#/$defs/point_mm"
        },
        "text": {
          "type": "string",
          "minLength": 1,
          "maxLength": 40
        },
        "height_mm": {
          "$ref": "#/$defs/length_mm"
        },
        "depth_mm": {
          "type": "number",
          "exclusiveMinimum": 0,
          "maximum": 20
        },
        "mode": {
          "enum": [
            "raised",
            "engraved"
          ],
          "default": "raised"
        },
        "face": {
          "enum": [
            "top",
            "bottom"
          ],
          "default": "top"
        },
        "angle_deg": {
          "$ref": "#/$defs/angle_deg",
          "default": 0
        }
      }
    },
    "outline": {
      "oneOf": [
        {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "kind",
            "width_mm",
            "length_mm"
          ],
          "properties": {
            "kind": {
              "const": "rectangle"
            },
            "width_mm": {
              "$ref": "#/$defs/length_mm"
            },
            "length_mm": {
              "$ref": "#/$defs/length_mm"
            },
            "corner_radius_mm": {
              "type": "number",
              "minimum": 0,
              "maximum": 1000,
              "default": 0
            }
          }
        },
        {
          "description": "A round plate centered on the plate origin. The edge is a true circle.",
          "type": "object",
          "additionalProperties": false,
          "required": [
            "kind",
            "diameter_mm"
          ],
          "properties": {
            "kind": {
              "const": "circle"
            },
            "diameter_mm": {
              "$ref": "#/$defs/length_mm"
            }
          }
        },
        {
          "description": "A closed polygon. The last point connects back to the first.",
          "type": "object",
          "additionalProperties": false,
          "required": [
            "kind",
            "points_mm"
          ],
          "properties": {
            "kind": {
              "const": "polygon"
            },
            "points_mm": {
              "type": "array",
              "minItems": 3,
              "maxItems": 200,
              "items": {
                "$ref": "#/$defs/point_mm"
              }
            }
          }
        }
      ]
    },
    "body": {
      "description": "A solid with a height, for boxes, vases, cups and knobs. The body frame has its origin at the center of the base, Z up, so the base sits at Z = 0 and the top at Z = height_mm. 'shape' says how it is made; 'shell' hollows it; 'edge_fillet_mm' rounds the outer top and bottom edges, or use edge_fillet_top_mm and edge_fillet_bottom_mm to round them separately; 'bores' drills blind holes; 'texture' adds vertical ridges or grooves on the outside wall.",
      "type": "object",
      "additionalProperties": false,
      "required": [
        "id",
        "type",
        "shape",
        "placement"
      ],
      "properties": {
        "id": {
          "$ref": "#/$defs/id"
        },
        "type": {
          "const": "body"
        },
        "shape": {
          "oneOf": [
            {
              "$ref": "#/$defs/extrude"
            },
            {
              "$ref": "#/$defs/revolve"
            }
          ]
        },
        "shell": {
          "$ref": "#/$defs/shell"
        },
        "edge_fillet_mm": {
          "description": "Radius that rounds the outer top and bottom edges. Must be smaller than the wall thickness when the body is hollow.",
          "type": "number",
          "exclusiveMinimum": 0,
          "maximum": 200
        },
        "placement": {
          "$ref": "#/$defs/placement"
        },
        "texture": {
          "$ref": "#/$defs/texture"
        },
        "edge_fillet_top_mm": {
          "description": "Radius that rounds only the outer top edge. Cannot be combined with edge_fillet_mm.",
          "type": "number",
          "exclusiveMinimum": 0,
          "maximum": 200
        },
        "edge_fillet_bottom_mm": {
          "description": "Radius that rounds only the outer bottom edge. Cannot be combined with edge_fillet_mm.",
          "type": "number",
          "exclusiveMinimum": 0,
          "maximum": 200
        },
        "bores": {
          "description": "Blind holes drilled into the body, such as the socket of a shift knob.",
          "type": "array",
          "minItems": 1,
          "maxItems": 8,
          "items": {
            "$ref": "#/$defs/bore"
          }
        }
      }
    },
    "extrude": {
      "description": "A prism: the outline, straight up by height_mm. A rectangle outline gives a box; a circle gives a cylinder.",
      "type": "object",
      "additionalProperties": false,
      "required": [
        "kind",
        "outline",
        "height_mm"
      ],
      "properties": {
        "kind": {
          "const": "extrude"
        },
        "outline": {
          "$ref": "#/$defs/outline"
        },
        "height_mm": {
          "$ref": "#/$defs/length_mm"
        }
      }
    },
    "shell": {
      "description": "Hollows the body, leaving walls of wall_thickness_mm. open 'top' removes the top face (a vase, cup or box); 'none' makes a closed hollow part. The base stays as thick as the walls.",
      "type": "object",
      "additionalProperties": false,
      "required": [
        "wall_thickness_mm",
        "open"
      ],
      "properties": {
        "wall_thickness_mm": {
          "$ref": "#/$defs/length_mm"
        },
        "open": {
          "enum": [
            "top",
            "none"
          ]
        }
      }
    },
    "revolve": {
      "description": "A solid of revolution about the body's Z axis: vases, cups, knobs, bottles. 'profile_mm' lists [radius, z] points of the outside surface from the base up to the rim, with z strictly increasing (no overhangs, so it prints without supports). The base is a flat disc from the axis out to the first point, and the top is closed flat unless the body is hollowed open at the top. Use many points for a smooth curve.",
      "type": "object",
      "additionalProperties": false,
      "required": [
        "kind",
        "profile_mm"
      ],
      "properties": {
        "kind": {
          "const": "revolve"
        },
        "profile_mm": {
          "type": "array",
          "minItems": 2,
          "maxItems": 100,
          "items": {
            "$ref": "#/$defs/point_mm"
          }
        }
      }
    },
    "texture": {
      "description": "A repeating pattern of vertical stripes on the outside wall: 'ridges' stand out by depth_mm, 'grooves' are cut in by depth_mm (and must be shallower than the wall if the body is hollow). 'spacing_mm' is the distance between stripe centers along a flat side, or around the widest part of a round body. Stripes run the full height unless 'z_range_mm' [from, to] limits them. Supported on rectangle and circle extrusions and on revolved bodies.",
      "type": "object",
      "additionalProperties": false,
      "required": [
        "kind",
        "width_mm",
        "depth_mm",
        "spacing_mm"
      ],
      "properties": {
        "kind": {
          "enum": [
            "ridges",
            "grooves"
          ]
        },
        "width_mm": {
          "$ref": "#/$defs/length_mm"
        },
        "depth_mm": {
          "$ref": "#/$defs/length_mm"
        },
        "spacing_mm": {
          "$ref": "#/$defs/length_mm"
        },
        "z_range_mm": {
          "type": "array",
          "minItems": 2,
          "maxItems": 2,
          "items": {
            "type": "number",
            "minimum": 0,
            "maximum": 2000
          }
        }
      }
    },
    "bore": {
      "description": "A round hole drilled into a body along its Z axis and stopping at depth_mm (a blind bore). from 'bottom' drills up from the base face and 'top' drills down from the top face. position_mm is [x, y] from the body's center, default [0, 0]. For a threaded hole, use the tap-drill diameter (8.8 mm for M10x1.25), not the thread's outer diameter.",
      "type": "object",
      "additionalProperties": false,
      "required": [
        "diameter_mm",
        "depth_mm",
        "from"
      ],
      "properties": {
        "diameter_mm": {
          "$ref": "#/$defs/length_mm"
        },
        "depth_mm": {
          "$ref": "#/$defs/length_mm"
        },
        "from": {
          "enum": [
            "bottom",
            "top"
          ]
        },
        "position_mm": {
          "$ref": "#/$defs/point_mm"
        }
      }
    },
    "tube": {
      "description": "A round pipe swept along a 3D path. 'path_mm' lists [x, y, z] corner points in the part frame (relative to 'placement'); each corner between two straight runs is rounded with 'bend_radius_mm' (the centerline radius, default 1.5 times the outer diameter). 'wall_thickness_mm' makes it hollow with open ends; leave it out for a solid rod. The ends are cut square to the first and last run.",
      "type": "object",
      "additionalProperties": false,
      "required": [
        "id",
        "type",
        "path_mm",
        "outer_diameter_mm",
        "placement"
      ],
      "properties": {
        "id": {
          "$ref": "#/$defs/id"
        },
        "type": {
          "const": "tube"
        },
        "path_mm": {
          "type": "array",
          "minItems": 2,
          "maxItems": 64,
          "items": {
            "type": "array",
            "minItems": 3,
            "maxItems": 3,
            "items": {
              "type": "number",
              "minimum": -10000,
              "maximum": 10000
            }
          }
        },
        "outer_diameter_mm": {
          "type": "number",
          "exclusiveMinimum": 0,
          "maximum": 500
        },
        "wall_thickness_mm": {
          "type": "number",
          "exclusiveMinimum": 0,
          "maximum": 250
        },
        "bend_radius_mm": {
          "type": "number",
          "exclusiveMinimum": 0,
          "maximum": 2000
        },
        "placement": {
          "$ref": "#/$defs/placement"
        }
      }
    },
    "merge": {
      "description": "Fuses two or more tubes that overlap into one solid, then clears every tube's bore so the passages join (a collector where runners meet). The merged tubes are not built separately. A tube can be in only one merge.",
      "type": "object",
      "additionalProperties": false,
      "required": [
        "id",
        "type",
        "tubes"
      ],
      "properties": {
        "id": {
          "$ref": "#/$defs/id"
        },
        "type": {
          "const": "merge"
        },
        "tubes": {
          "type": "array",
          "minItems": 2,
          "maxItems": 16,
          "uniqueItems": true,
          "items": {
            "$ref": "#/$defs/id"
          }
        }
      }
    },
    "reducer": {
      "description": "A straight pipe whose outer diameter changes linearly from 'start_diameter_mm' at 'start_mm' to 'end_diameter_mm' at 'end_mm' (points in the part frame, relative to 'placement'). 'wall_thickness_mm' makes it hollow with open ends. It can join a merge like a tube.",
      "type": "object",
      "additionalProperties": false,
      "required": [
        "id",
        "type",
        "start_mm",
        "end_mm",
        "start_diameter_mm",
        "end_diameter_mm",
        "placement"
      ],
      "properties": {
        "id": {
          "$ref": "#/$defs/id"
        },
        "type": {
          "const": "reducer"
        },
        "start_mm": {
          "type": "array",
          "minItems": 3,
          "maxItems": 3,
          "items": {
            "type": "number",
            "minimum": -10000,
            "maximum": 10000
          }
        },
        "end_mm": {
          "type": "array",
          "minItems": 3,
          "maxItems": 3,
          "items": {
            "type": "number",
            "minimum": -10000,
            "maximum": 10000
          }
        },
        "start_diameter_mm": {
          "type": "number",
          "exclusiveMinimum": 0,
          "maximum": 500
        },
        "end_diameter_mm": {
          "type": "number",
          "exclusiveMinimum": 0,
          "maximum": 500
        },
        "wall_thickness_mm": {
          "type": "number",
          "exclusiveMinimum": 0,
          "maximum": 250
        },
        "placement": {
          "$ref": "#/$defs/placement"
        }
      }
    },
    "flange": {
      "description": "A bolted end plate on one end of a hollow tube or reducer ('tube' is its id, 'end' is 'start' or 'end' of the path). The flange face is flush with the pipe's open end and the plate extends back along the pipe by 'thickness_mm'. The pipe bore runs through it. Bolt holes are placed in the flange frame: origin on the pipe axis, X and Y in the face seen from outside, X chosen as the world Z axis crossed with the outward direction (world X if the pipe points along Z). On a volute the ends are 'inlet' (the straight inlet stub) and 'outlet' (the axial exhaust outlet).",
      "type": "object",
      "additionalProperties": false,
      "required": [
        "id",
        "type",
        "tube",
        "end",
        "outline",
        "thickness_mm"
      ],
      "properties": {
        "id": {
          "$ref": "#/$defs/id"
        },
        "type": {
          "const": "flange"
        },
        "tube": {
          "$ref": "#/$defs/id"
        },
        "end": {
          "enum": [
            "start",
            "end",
            "inlet",
            "outlet"
          ]
        },
        "outline": {
          "oneOf": [
            {
              "type": "object",
              "additionalProperties": false,
              "required": [
                "kind",
                "diameter_mm"
              ],
              "properties": {
                "kind": {
                  "const": "circle"
                },
                "diameter_mm": {
                  "type": "number",
                  "exclusiveMinimum": 0,
                  "maximum": 1000
                }
              }
            },
            {
              "type": "object",
              "additionalProperties": false,
              "required": [
                "kind",
                "width_mm",
                "length_mm"
              ],
              "properties": {
                "kind": {
                  "const": "rectangle"
                },
                "width_mm": {
                  "type": "number",
                  "exclusiveMinimum": 0,
                  "maximum": 1000
                },
                "length_mm": {
                  "type": "number",
                  "exclusiveMinimum": 0,
                  "maximum": 1000
                }
              }
            }
          ]
        },
        "thickness_mm": {
          "type": "number",
          "exclusiveMinimum": 0,
          "maximum": 100
        },
        "bolt_holes": {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "hole_diameter_mm",
            "pattern"
          ],
          "properties": {
            "hole_diameter_mm": {
              "type": "number",
              "exclusiveMinimum": 0,
              "maximum": 100
            },
            "pattern": {
              "oneOf": [
                {
                  "type": "object",
                  "additionalProperties": false,
                  "required": [
                    "kind",
                    "count",
                    "circle_diameter_mm"
                  ],
                  "properties": {
                    "kind": {
                      "const": "circular"
                    },
                    "count": {
                      "type": "integer",
                      "minimum": 1,
                      "maximum": 32
                    },
                    "circle_diameter_mm": {
                      "type": "number",
                      "exclusiveMinimum": 0,
                      "maximum": 1000
                    },
                    "start_angle_deg": {
                      "type": "number",
                      "minimum": -360,
                      "maximum": 360,
                      "default": 0
                    }
                  }
                },
                {
                  "type": "object",
                  "additionalProperties": false,
                  "required": [
                    "kind",
                    "points_mm"
                  ],
                  "properties": {
                    "kind": {
                      "const": "points"
                    },
                    "points_mm": {
                      "type": "array",
                      "minItems": 1,
                      "maxItems": 32,
                      "items": {
                        "$ref": "#/$defs/point_mm"
                      }
                    }
                  }
                }
              ]
            }
          }
        }
      }
    },
    "volute": {
      "description": "A turbine-style scroll housing (turbo exhaust housing). Frame: origin on the wheel axis at the wheel plane, Z along the axis, outlet towards -Z. The passage starts at the tongue on the +X axis and winds counter-clockwise seen from +Z; its round section area grows linearly with angle and is sized so the largest section has the given 'a_over_r_cm' (area in cm2 over centroid radius in cm, as vendors quote A/R). Its inner edge opens onto the wheel cavity (inducer diameter plus clearance). The inlet is a straight stub of the largest section on the +X side, centered at x = cavity radius + largest section radius, flowing +Y and entering from -Y. The outlet is a cone down to the exducer bore. Walls are 'wall_thickness_mm' all round. Simplified: no wastegate, bearing flange or vanes.",
      "type": "object",
      "additionalProperties": false,
      "required": [
        "id",
        "type",
        "inducer_diameter_mm",
        "exducer_diameter_mm",
        "a_over_r_cm",
        "wall_thickness_mm",
        "placement"
      ],
      "properties": {
        "id": {
          "$ref": "#/$defs/id"
        },
        "type": {
          "const": "volute"
        },
        "inducer_diameter_mm": {
          "type": "number",
          "exclusiveMinimum": 0,
          "maximum": 300
        },
        "exducer_diameter_mm": {
          "type": "number",
          "exclusiveMinimum": 0,
          "maximum": 300
        },
        "a_over_r_cm": {
          "type": "number",
          "exclusiveMinimum": 0,
          "maximum": 20
        },
        "wall_thickness_mm": {
          "type": "number",
          "exclusiveMinimum": 0,
          "maximum": 50
        },
        "tongue_clearance_mm": {
          "type": "number",
          "minimum": 0,
          "maximum": 20,
          "default": 2
        },
        "inlet_length_mm": {
          "type": "number",
          "exclusiveMinimum": 0,
          "maximum": 500
        },
        "outlet_length_mm": {
          "type": "number",
          "exclusiveMinimum": 0,
          "maximum": 500
        },
        "placement": {
          "$ref": "#/$defs/placement"
        }
      }
    },
    "sketch_point": {
      "type": "array",
      "minItems": 2,
      "maxItems": 2,
      "items": {
        "type": "number",
        "minimum": -10000,
        "maximum": 10000
      }
    },
    "sketch_loop": {
      "description": "A closed 2D outline in the sketch plane (x, y in mm). 'circle', 'rectangle' (width along x) and 'ellipse' are centered on 'center_mm' (default [0, 0]). 'polygon' joins its points with straight lines. 'path' starts at 'start_mm' and follows 'segments': a 'line' to a point, a three-point 'arc' (through 'mid_mm' to 'to_mm') or a smooth 'spline' through the listed points (the last one is where it ends). A path closes itself back to its start with a straight line.",
      "oneOf": [
        {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "kind",
            "diameter_mm"
          ],
          "properties": {
            "kind": {
              "const": "circle"
            },
            "center_mm": {
              "$ref": "#/$defs/sketch_point"
            },
            "diameter_mm": {
              "type": "number",
              "exclusiveMinimum": 0,
              "maximum": 2000
            }
          }
        },
        {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "kind",
            "width_mm",
            "height_mm"
          ],
          "properties": {
            "kind": {
              "const": "rectangle"
            },
            "center_mm": {
              "$ref": "#/$defs/sketch_point"
            },
            "width_mm": {
              "type": "number",
              "exclusiveMinimum": 0,
              "maximum": 2000
            },
            "height_mm": {
              "type": "number",
              "exclusiveMinimum": 0,
              "maximum": 2000
            }
          }
        },
        {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "kind",
            "major_mm",
            "minor_mm"
          ],
          "properties": {
            "kind": {
              "const": "ellipse"
            },
            "center_mm": {
              "$ref": "#/$defs/sketch_point"
            },
            "major_mm": {
              "type": "number",
              "exclusiveMinimum": 0,
              "maximum": 2000
            },
            "minor_mm": {
              "type": "number",
              "exclusiveMinimum": 0,
              "maximum": 2000
            },
            "rotation_deg": {
              "type": "number",
              "minimum": -360,
              "maximum": 360
            }
          }
        },
        {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "kind",
            "points_mm"
          ],
          "properties": {
            "kind": {
              "const": "polygon"
            },
            "points_mm": {
              "type": "array",
              "minItems": 3,
              "maxItems": 256,
              "items": {
                "$ref": "#/$defs/sketch_point"
              }
            }
          }
        },
        {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "kind",
            "start_mm",
            "segments"
          ],
          "properties": {
            "kind": {
              "const": "path"
            },
            "start_mm": {
              "$ref": "#/$defs/sketch_point"
            },
            "segments": {
              "type": "array",
              "minItems": 1,
              "maxItems": 256,
              "items": {
                "oneOf": [
                  {
                    "type": "object",
                    "additionalProperties": false,
                    "required": [
                      "kind",
                      "to_mm"
                    ],
                    "properties": {
                      "kind": {
                        "const": "line"
                      },
                      "to_mm": {
                        "$ref": "#/$defs/sketch_point"
                      }
                    }
                  },
                  {
                    "type": "object",
                    "additionalProperties": false,
                    "required": [
                      "kind",
                      "mid_mm",
                      "to_mm"
                    ],
                    "properties": {
                      "kind": {
                        "const": "arc"
                      },
                      "mid_mm": {
                        "$ref": "#/$defs/sketch_point"
                      },
                      "to_mm": {
                        "$ref": "#/$defs/sketch_point"
                      }
                    }
                  },
                  {
                    "type": "object",
                    "additionalProperties": false,
                    "required": [
                      "kind",
                      "through_mm"
                    ],
                    "properties": {
                      "kind": {
                        "const": "spline"
                      },
                      "through_mm": {
                        "type": "array",
                        "minItems": 2,
                        "maxItems": 64,
                        "items": {
                          "$ref": "#/$defs/sketch_point"
                        }
                      }
                    }
                  }
                ]
              }
            }
          }
        }
      ]
    },
    "sketch": {
      "description": "2D shapes on a plane. 'plane' is 'XY' (x right, y up the sketch, normal +Z), 'XZ' (x = world X, y = world Z, normal -Y) or 'YZ' (x = world Y, y = world Z, normal +X), moved 'offset_mm' along its normal and/or to 'origin_mm' in the part frame. Each shape is an 'outer' outline with optional 'holes' (outlines inside it).",
      "type": "object",
      "additionalProperties": false,
      "required": [
        "id",
        "type",
        "plane",
        "shapes"
      ],
      "properties": {
        "id": {
          "$ref": "#/$defs/id"
        },
        "type": {
          "const": "sketch"
        },
        "plane": {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "name"
          ],
          "properties": {
            "name": {
              "enum": [
                "XY",
                "XZ",
                "YZ"
              ]
            },
            "offset_mm": {
              "type": "number",
              "minimum": -10000,
              "maximum": 10000
            },
            "origin_mm": {
              "type": "array",
              "minItems": 3,
              "maxItems": 3,
              "items": {
                "type": "number",
                "minimum": -10000,
                "maximum": 10000
              }
            }
          }
        },
        "shapes": {
          "type": "array",
          "minItems": 1,
          "maxItems": 32,
          "items": {
            "type": "object",
            "additionalProperties": false,
            "required": [
              "outer"
            ],
            "properties": {
              "outer": {
                "$ref": "#/$defs/sketch_loop"
              },
              "holes": {
                "type": "array",
                "minItems": 1,
                "maxItems": 64,
                "items": {
                  "$ref": "#/$defs/sketch_loop"
                }
              }
            }
          }
        }
      }
    },
    "extrude_feature": {
      "description": "Pushes a sketch into a solid. 'distance_mm' is the length; 'direction' is 'normal' (along the plane normal, default), 'reverse' or 'symmetric' (half each way); 'taper_deg' leans the sides in (positive) or out. 'operation' 'new' (default) makes a solid named by this feature's id; 'add', 'cut' and 'intersect' combine the result with the solid named by 'target', and the combined solid takes this feature's id.",
      "type": "object",
      "additionalProperties": false,
      "required": [
        "id",
        "type",
        "sketch",
        "distance_mm"
      ],
      "properties": {
        "id": {
          "$ref": "#/$defs/id"
        },
        "type": {
          "const": "extrude"
        },
        "sketch": {
          "$ref": "#/$defs/id"
        },
        "distance_mm": {
          "type": "number",
          "exclusiveMinimum": 0,
          "maximum": 5000
        },
        "direction": {
          "enum": [
            "normal",
            "reverse",
            "symmetric"
          ],
          "default": "normal"
        },
        "taper_deg": {
          "type": "number",
          "minimum": -45,
          "maximum": 45
        },
        "operation": {
          "enum": [
            "new",
            "add",
            "cut",
            "intersect"
          ],
          "default": "new"
        },
        "target": {
          "$ref": "#/$defs/id"
        }
      }
    },
    "revolve_feature": {
      "description": "Spins a sketch about an axis in the sketch plane into a solid. 'axis' is a line from 'from_mm' to 'to_mm' in sketch coordinates (default: the sketch's y axis); the sketch must stay on one side of it. 'angle_deg' is the sweep (default 360). 'operation' and 'target' work as for extrude.",
      "type": "object",
      "additionalProperties": false,
      "required": [
        "id",
        "type",
        "sketch"
      ],
      "properties": {
        "id": {
          "$ref": "#/$defs/id"
        },
        "type": {
          "const": "revolve"
        },
        "sketch": {
          "$ref": "#/$defs/id"
        },
        "axis": {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "from_mm",
            "to_mm"
          ],
          "properties": {
            "from_mm": {
              "$ref": "#/$defs/sketch_point"
            },
            "to_mm": {
              "$ref": "#/$defs/sketch_point"
            }
          }
        },
        "angle_deg": {
          "type": "number",
          "exclusiveMinimum": 0,
          "maximum": 360,
          "default": 360
        },
        "operation": {
          "enum": [
            "new",
            "add",
            "cut",
            "intersect"
          ],
          "default": "new"
        },
        "target": {
          "$ref": "#/$defs/id"
        }
      }
    },
    "boolean": {
      "description": "Combines solids: 'union' joins 'target' and every tool, 'cut' removes the tools from the target, 'intersect' keeps only the shared volume. The target and tools are used up; the result takes this feature's id.",
      "type": "object",
      "additionalProperties": false,
      "required": [
        "id",
        "type",
        "operation",
        "target",
        "tools"
      ],
      "properties": {
        "id": {
          "$ref": "#/$defs/id"
        },
        "type": {
          "const": "boolean"
        },
        "operation": {
          "enum": [
            "union",
            "cut",
            "intersect"
          ]
        },
        "target": {
          "$ref": "#/$defs/id"
        },
        "tools": {
          "type": "array",
          "minItems": 1,
          "maxItems": 32,
          "uniqueItems": true,
          "items": {
            "$ref": "#/$defs/id"
          }
        }
      }
    },
    "transform": {
      "description": "Moves a solid. Steps run in this order: 'mirror' across a plane ('XY', 'XZ' or 'YZ' of the part frame, moved 'offset_mm' along its normal), then 'rotate' about an axis through 'axis_point_mm' with direction 'axis_dir', then 'translate_mm'. The result takes this feature's id. With 'copy' true the source solid stays too (use it to repeat a shape); otherwise the source is used up.",
      "type": "object",
      "additionalProperties": false,
      "required": [
        "id",
        "type",
        "source"
      ],
      "properties": {
        "id": {
          "$ref": "#/$defs/id"
        },
        "type": {
          "const": "transform"
        },
        "source": {
          "$ref": "#/$defs/id"
        },
        "translate_mm": {
          "type": "array",
          "minItems": 3,
          "maxItems": 3,
          "items": {
            "type": "number",
            "minimum": -10000,
            "maximum": 10000
          }
        },
        "rotate": {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "axis_point_mm",
            "axis_dir",
            "angle_deg"
          ],
          "properties": {
            "axis_point_mm": {
              "type": "array",
              "minItems": 3,
              "maxItems": 3,
              "items": {
                "type": "number",
                "minimum": -10000,
                "maximum": 10000
              }
            },
            "axis_dir": {
              "type": "array",
              "minItems": 3,
              "maxItems": 3,
              "items": {
                "type": "number",
                "minimum": -10000,
                "maximum": 10000
              }
            },
            "angle_deg": {
              "type": "number",
              "minimum": -360,
              "maximum": 360
            }
          }
        },
        "mirror": {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "plane"
          ],
          "properties": {
            "plane": {
              "enum": [
                "XY",
                "XZ",
                "YZ"
              ]
            },
            "offset_mm": {
              "type": "number",
              "minimum": -10000,
              "maximum": 10000
            }
          }
        },
        "copy": {
          "type": "boolean",
          "default": false
        }
      }
    },
    "curve": {
      "description": "An open path on a plane (same planes as a sketch), for 'sweep' to follow. Starts at 'start_mm' and continues through line, 3-point arc and spline segments.",
      "type": "object",
      "additionalProperties": false,
      "required": [
        "id",
        "type",
        "plane",
        "start_mm",
        "segments"
      ],
      "properties": {
        "id": {
          "$ref": "#/$defs/id"
        },
        "type": {
          "const": "curve"
        },
        "plane": {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "name"
          ],
          "properties": {
            "name": {
              "enum": [
                "XY",
                "XZ",
                "YZ"
              ]
            },
            "offset_mm": {
              "type": "number",
              "minimum": -10000,
              "maximum": 10000
            },
            "origin_mm": {
              "type": "array",
              "minItems": 3,
              "maxItems": 3,
              "items": {
                "type": "number",
                "minimum": -10000,
                "maximum": 10000
              }
            }
          }
        },
        "start_mm": {
          "$ref": "#/$defs/sketch_point"
        },
        "segments": {
          "type": "array",
          "minItems": 1,
          "maxItems": 256,
          "items": {
            "oneOf": [
              {
                "type": "object",
                "additionalProperties": false,
                "required": [
                  "kind",
                  "to_mm"
                ],
                "properties": {
                  "kind": {
                    "const": "line"
                  },
                  "to_mm": {
                    "$ref": "#/$defs/sketch_point"
                  }
                }
              },
              {
                "type": "object",
                "additionalProperties": false,
                "required": [
                  "kind",
                  "mid_mm",
                  "to_mm"
                ],
                "properties": {
                  "kind": {
                    "const": "arc"
                  },
                  "mid_mm": {
                    "$ref": "#/$defs/sketch_point"
                  },
                  "to_mm": {
                    "$ref": "#/$defs/sketch_point"
                  }
                }
              },
              {
                "type": "object",
                "additionalProperties": false,
                "required": [
                  "kind",
                  "through_mm"
                ],
                "properties": {
                  "kind": {
                    "const": "spline"
                  },
                  "through_mm": {
                    "type": "array",
                    "minItems": 2,
                    "maxItems": 64,
                    "items": {
                      "$ref": "#/$defs/sketch_point"
                    }
                  }
                }
              }
            ]
          }
        }
      }
    },
    "sweep": {
      "description": "Drags the first outline of sketch 'profile' along curve 'path' to make a solid. The profile's plane should pass through the curve's start and face along it. 'operation' and 'target' work as for extrude.",
      "type": "object",
      "additionalProperties": false,
      "required": [
        "id",
        "type",
        "profile",
        "path"
      ],
      "properties": {
        "id": {
          "$ref": "#/$defs/id"
        },
        "type": {
          "const": "sweep"
        },
        "profile": {
          "$ref": "#/$defs/id"
        },
        "path": {
          "$ref": "#/$defs/id"
        },
        "operation": {
          "enum": [
            "new",
            "add",
            "cut",
            "intersect"
          ],
          "default": "new"
        },
        "target": {
          "$ref": "#/$defs/id"
        }
      }
    },
    "loft": {
      "description": "Blends a solid through two or more sketches in the order listed (each sketch holds one outline, no holes). 'ruled' joins them with straight faces instead of a smooth blend. 'operation' and 'target' work as for extrude.",
      "type": "object",
      "additionalProperties": false,
      "required": [
        "id",
        "type",
        "sketches"
      ],
      "properties": {
        "id": {
          "$ref": "#/$defs/id"
        },
        "type": {
          "const": "loft"
        },
        "sketches": {
          "type": "array",
          "minItems": 2,
          "maxItems": 16,
          "items": {
            "$ref": "#/$defs/id"
          }
        },
        "ruled": {
          "type": "boolean",
          "default": false
        },
        "operation": {
          "enum": [
            "new",
            "add",
            "cut",
            "intersect"
          ],
          "default": "new"
        },
        "target": {
          "$ref": "#/$defs/id"
        }
      }
    },
    "edge_selector": {
      "description": "Which edges. 'all', or a list of choices whose edges are combined: {parallel: X|Y|Z} straight edges running along that axis; {on_face: top|bottom|left|right|front|back} edges of the outermost face on that side (top +Z, bottom -Z, right +X, left -X, back +Y, front -Y); {near_mm: [x,y,z], within_mm: r} edges whose middle lies within r of the point.",
      "oneOf": [
        {
          "const": "all"
        },
        {
          "type": "array",
          "minItems": 1,
          "maxItems": 16,
          "items": {
            "oneOf": [
              {
                "type": "object",
                "additionalProperties": false,
                "required": [
                  "parallel"
                ],
                "properties": {
                  "parallel": {
                    "enum": [
                      "X",
                      "Y",
                      "Z"
                    ]
                  }
                }
              },
              {
                "type": "object",
                "additionalProperties": false,
                "required": [
                  "on_face"
                ],
                "properties": {
                  "on_face": {
                    "enum": [
                      "top",
                      "bottom",
                      "left",
                      "right",
                      "front",
                      "back"
                    ]
                  }
                }
              },
              {
                "type": "object",
                "additionalProperties": false,
                "required": [
                  "near_mm",
                  "within_mm"
                ],
                "properties": {
                  "near_mm": {
                    "type": "array",
                    "minItems": 3,
                    "maxItems": 3,
                    "items": {
                      "type": "number",
                      "minimum": -10000,
                      "maximum": 10000
                    }
                  },
                  "within_mm": {
                    "type": "number",
                    "exclusiveMinimum": 0,
                    "maximum": 10000
                  }
                }
              }
            ]
          }
        }
      ]
    },
    "fillet_edges": {
      "description": "Rounds chosen edges of the solid named 'solid'. The solid is used up; the result takes this feature's id.",
      "type": "object",
      "additionalProperties": false,
      "required": [
        "id",
        "type",
        "solid",
        "edges",
        "radius_mm"
      ],
      "properties": {
        "id": {
          "$ref": "#/$defs/id"
        },
        "type": {
          "const": "fillet_edges"
        },
        "solid": {
          "$ref": "#/$defs/id"
        },
        "edges": {
          "$ref": "#/$defs/edge_selector"
        },
        "radius_mm": {
          "type": "number",
          "exclusiveMinimum": 0,
          "maximum": 500
        }
      }
    },
    "chamfer_edges": {
      "description": "Bevels chosen edges of the solid named 'solid'. The solid is used up; the result takes this feature's id.",
      "type": "object",
      "additionalProperties": false,
      "required": [
        "id",
        "type",
        "solid",
        "edges",
        "distance_mm"
      ],
      "properties": {
        "id": {
          "$ref": "#/$defs/id"
        },
        "type": {
          "const": "chamfer_edges"
        },
        "solid": {
          "$ref": "#/$defs/id"
        },
        "edges": {
          "$ref": "#/$defs/edge_selector"
        },
        "distance_mm": {
          "type": "number",
          "exclusiveMinimum": 0,
          "maximum": 500
        }
      }
    },
    "hollow": {
      "description": "Makes the solid 'solid' thin-walled with wall 'thickness_mm', growing inward. 'open_sides' removes those sides (top +Z, bottom -Z, right +X, left -X, back +Y, front -Y) so the part becomes a cup or tray; with none, it is a closed hollow. The solid is used up; the result takes this feature's id.",
      "type": "object",
      "additionalProperties": false,
      "required": [
        "id",
        "type",
        "solid",
        "thickness_mm"
      ],
      "properties": {
        "id": {
          "$ref": "#/$defs/id"
        },
        "type": {
          "const": "hollow"
        },
        "solid": {
          "$ref": "#/$defs/id"
        },
        "thickness_mm": {
          "type": "number",
          "exclusiveMinimum": 0,
          "maximum": 500
        },
        "open_sides": {
          "type": "array",
          "minItems": 1,
          "maxItems": 6,
          "uniqueItems": true,
          "items": {
            "enum": [
              "top",
              "bottom",
              "left",
              "right",
              "front",
              "back"
            ]
          }
        }
      }
    },
    "linear_pattern": {
      "description": "Repeats the solid 'source' 'count' times, each copy 'spacing_mm' [x,y,z] further along than the last, and joins them into one solid (copies must touch or be tools for a cut). The source is used up; the result takes this feature's id.",
      "type": "object",
      "additionalProperties": false,
      "required": [
        "id",
        "type",
        "source",
        "count",
        "spacing_mm"
      ],
      "properties": {
        "id": {
          "$ref": "#/$defs/id"
        },
        "type": {
          "const": "linear_pattern"
        },
        "source": {
          "$ref": "#/$defs/id"
        },
        "count": {
          "type": "integer",
          "minimum": 2,
          "maximum": 200
        },
        "spacing_mm": {
          "type": "array",
          "minItems": 3,
          "maxItems": 3,
          "items": {
            "type": "number",
            "minimum": -10000,
            "maximum": 10000
          }
        }
      }
    },
    "circular_pattern": {
      "description": "Repeats the solid 'source' 'count' times around an axis through 'axis_point_mm' along 'axis_dir', spread over 'angle_deg' (default 360, evenly around; a smaller angle puts the first and last copies that far apart). Copies are joined into one solid.",
      "type": "object",
      "additionalProperties": false,
      "required": [
        "id",
        "type",
        "source",
        "count",
        "axis_point_mm",
        "axis_dir"
      ],
      "properties": {
        "id": {
          "$ref": "#/$defs/id"
        },
        "type": {
          "const": "circular_pattern"
        },
        "source": {
          "$ref": "#/$defs/id"
        },
        "count": {
          "type": "integer",
          "minimum": 2,
          "maximum": 200
        },
        "axis_point_mm": {
          "type": "array",
          "minItems": 3,
          "maxItems": 3,
          "items": {
            "type": "number",
            "minimum": -10000,
            "maximum": 10000
          }
        },
        "axis_dir": {
          "type": "array",
          "minItems": 3,
          "maxItems": 3,
          "items": {
            "type": "number",
            "minimum": -1,
            "maximum": 1
          }
        },
        "angle_deg": {
          "type": "number",
          "exclusiveMinimum": 0,
          "maximum": 360
        }
      }
    },
    "mirror": {
      "description": "Adds a mirrored copy of 'source' across plane 'plane' ('XY', 'XZ' or 'YZ', moved 'offset_mm'), joined to the original. The source is used up; the result takes this feature's id. (To keep them as two separate solids use 'transform' with mirror and copy.)",
      "type": "object",
      "additionalProperties": false,
      "required": [
        "id",
        "type",
        "source",
        "plane"
      ],
      "properties": {
        "id": {
          "$ref": "#/$defs/id"
        },
        "type": {
          "const": "mirror"
        },
        "source": {
          "$ref": "#/$defs/id"
        },
        "plane": {
          "enum": [
            "XY",
            "XZ",
            "YZ"
          ]
        },
        "offset_mm": {
          "type": "number",
          "minimum": -10000,
          "maximum": 10000
        }
      }
    },
    "draft": {
      "description": "Leans faces of 'solid' by 'angle_deg' (0.1 to 30), as a mould needs so the part can be pulled out. The neutral plane is at the bottom of the part along 'pull_direction' ('X', 'Y' or 'Z', default 'Z'), or at the top with neutral 'top'; faces stay put there and lean inward as they get further away (a positive angle makes the part narrower away from the neutral plane). 'faces' is 'sides' (every face except flat ones facing along the pull direction) or a list of sides (top, bottom, left, right, front, back) naming the outermost face on that side. The solid is used up; the result takes this feature's id.",
      "type": "object",
      "additionalProperties": false,
      "required": [
        "id",
        "type",
        "solid",
        "angle_deg",
        "faces"
      ],
      "properties": {
        "id": {
          "$ref": "#/$defs/id"
        },
        "type": {
          "const": "draft"
        },
        "solid": {
          "$ref": "#/$defs/id"
        },
        "angle_deg": {
          "type": "number",
          "minimum": 0.1,
          "maximum": 30
        },
        "pull_direction": {
          "enum": [
            "X",
            "Y",
            "Z"
          ],
          "default": "Z"
        },
        "neutral": {
          "enum": [
            "bottom",
            "top"
          ],
          "default": "bottom"
        },
        "faces": {
          "oneOf": [
            {
              "const": "sides"
            },
            {
              "type": "array",
              "minItems": 1,
              "maxItems": 6,
              "items": {
                "enum": [
                  "top",
                  "bottom",
                  "left",
                  "right",
                  "front",
                  "back"
                ]
              }
            }
          ]
        }
      }
    }
  }
};

export const PART_SPEC_V4_3_EXAMPLES: Record<string, unknown>[] = [
  {
    "spec_version": "4.3",
    "name": "L-bracket",
    "features": [
      {
        "id": "flange",
        "type": "plate",
        "outline": {
          "kind": "rectangle",
          "width_mm": 50,
          "length_mm": 30
        },
        "thickness_mm": 3,
        "placement": {
          "anchor": "origin"
        }
      },
      {
        "id": "leg",
        "type": "plate",
        "outline": {
          "kind": "rectangle",
          "width_mm": 50,
          "length_mm": 40
        },
        "thickness_mm": 3,
        "placement": {
          "anchor": "origin"
        }
      },
      {
        "id": "bend_1",
        "type": "bend",
        "from_plate": "flange",
        "from_edge": "+y",
        "to_plate": "leg",
        "to_edge": "-y",
        "angle_deg": 90,
        "inner_radius_mm": 3
      }
    ]
  },
  {
    "spec_version": "4.3",
    "name": "Plate with chamfered top edge",
    "features": [
      {
        "id": "base",
        "type": "plate",
        "outline": {
          "kind": "rectangle",
          "width_mm": 60,
          "length_mm": 40
        },
        "thickness_mm": 4,
        "placement": {
          "anchor": "origin"
        }
      },
      {
        "id": "chamfer_1",
        "type": "chamfer",
        "plate": "base",
        "edges": "top",
        "distance_mm": 1
      }
    ]
  },
  {
    "spec_version": "4.3",
    "name": "Plate with a counterbore",
    "features": [
      {
        "id": "base",
        "type": "plate",
        "outline": {
          "kind": "rectangle",
          "width_mm": 60,
          "length_mm": 40
        },
        "thickness_mm": 4,
        "placement": {
          "anchor": "origin"
        }
      },
      {
        "id": "cb_1",
        "type": "counterbore",
        "plate": "base",
        "position_mm": [
          0,
          0
        ],
        "diameter_mm": 5.5,
        "bore_diameter_mm": 10,
        "bore_depth_mm": 3
      }
    ]
  },
  {
    "spec_version": "4.3",
    "name": "Plate with a countersink",
    "features": [
      {
        "id": "base",
        "type": "plate",
        "outline": {
          "kind": "rectangle",
          "width_mm": 60,
          "length_mm": 40
        },
        "thickness_mm": 4,
        "placement": {
          "anchor": "origin"
        }
      },
      {
        "id": "cs_1",
        "type": "countersink",
        "plate": "base",
        "position_mm": [
          0,
          0
        ],
        "diameter_mm": 5,
        "sink_diameter_mm": 10,
        "sink_angle_deg": 90
      }
    ]
  },
  {
    "spec_version": "4.3",
    "name": "Plate with a clearance cutout",
    "features": [
      {
        "id": "base",
        "type": "plate",
        "outline": {
          "kind": "rectangle",
          "width_mm": 60,
          "length_mm": 40
        },
        "thickness_mm": 4,
        "placement": {
          "anchor": "origin"
        }
      },
      {
        "id": "clear_1",
        "type": "cutout",
        "plate": "base",
        "placement": {
          "anchor": "hose_clamp",
          "offset_mm": [
            0,
            0,
            0
          ]
        },
        "zone": {
          "kind": "circle",
          "diameter_mm": 16
        },
        "margin_mm": 2
      }
    ]
  },
  {
    "spec_version": "4.3",
    "name": "Plate with raised text",
    "features": [
      {
        "id": "base",
        "type": "plate",
        "outline": {
          "kind": "rectangle",
          "width_mm": 60,
          "length_mm": 40
        },
        "thickness_mm": 4,
        "placement": {
          "anchor": "origin"
        }
      },
      {
        "id": "label",
        "type": "emboss_text",
        "plate": "base",
        "position_mm": [
          0,
          0
        ],
        "text": "OIL",
        "height_mm": 8,
        "depth_mm": 0.8,
        "mode": "raised"
      }
    ]
  },
  {
    "spec_version": "4.3",
    "name": "Plate with filleted corners",
    "features": [
      {
        "id": "base",
        "type": "plate",
        "outline": {
          "kind": "rectangle",
          "width_mm": 60,
          "length_mm": 40
        },
        "thickness_mm": 4,
        "placement": {
          "anchor": "origin"
        }
      },
      {
        "id": "fillet_1",
        "type": "fillet",
        "plate": "base",
        "edges": "vertical",
        "radius_mm": 5
      }
    ]
  },
  {
    "spec_version": "4.3",
    "name": "Plate with a gusset",
    "features": [
      {
        "id": "base",
        "type": "plate",
        "outline": {
          "kind": "rectangle",
          "width_mm": 60,
          "length_mm": 40
        },
        "thickness_mm": 4,
        "placement": {
          "anchor": "origin"
        }
      },
      {
        "id": "gusset_1",
        "type": "rib",
        "plate": "base",
        "start_mm": [
          0,
          -15
        ],
        "end_mm": [
          0,
          15
        ],
        "thickness_mm": 3,
        "height_mm": 12,
        "profile": "triangular"
      }
    ]
  },
  {
    "spec_version": "4.3",
    "name": "Plate with a bolt circle",
    "features": [
      {
        "id": "base",
        "type": "plate",
        "outline": {
          "kind": "rectangle",
          "width_mm": 60,
          "length_mm": 40
        },
        "thickness_mm": 4,
        "placement": {
          "anchor": "origin"
        }
      },
      {
        "id": "ring",
        "type": "hole_pattern",
        "plate": "base",
        "diameter_mm": 4,
        "pattern": {
          "kind": "circular",
          "count": 6,
          "radius_mm": 12
        }
      }
    ]
  },
  {
    "spec_version": "4.3",
    "name": "Plate with a hole",
    "features": [
      {
        "id": "base",
        "type": "plate",
        "outline": {
          "kind": "rectangle",
          "width_mm": 60,
          "length_mm": 40
        },
        "thickness_mm": 4,
        "placement": {
          "anchor": "origin"
        }
      },
      {
        "id": "hole_1",
        "type": "hole",
        "plate": "base",
        "diameter_mm": 6.5,
        "position_mm": [
          0,
          0
        ]
      }
    ]
  },
  {
    "spec_version": "4.3",
    "name": "Plate with polygon outline",
    "features": [
      {
        "id": "base",
        "type": "plate",
        "outline": {
          "kind": "polygon",
          "points_mm": [
            [
              -30,
              -20
            ],
            [
              30,
              -20
            ],
            [
              30,
              10
            ],
            [
              10,
              20
            ],
            [
              -30,
              20
            ]
          ]
        },
        "thickness_mm": 4,
        "placement": {
          "anchor": "fender_bolt",
          "offset_mm": [
            0,
            0,
            2
          ],
          "rotation_deg": 15
        }
      }
    ]
  },
  {
    "spec_version": "4.3",
    "name": "Plate with rounded corners",
    "features": [
      {
        "id": "base",
        "type": "plate",
        "outline": {
          "kind": "rectangle",
          "width_mm": 60,
          "length_mm": 40,
          "corner_radius_mm": 6
        },
        "thickness_mm": 4,
        "placement": {
          "anchor": "origin"
        }
      }
    ]
  },
  {
    "spec_version": "4.3",
    "name": "Plate with a rib",
    "features": [
      {
        "id": "base",
        "type": "plate",
        "outline": {
          "kind": "rectangle",
          "width_mm": 60,
          "length_mm": 40
        },
        "thickness_mm": 4,
        "placement": {
          "anchor": "origin"
        }
      },
      {
        "id": "rib_1",
        "type": "rib",
        "plate": "base",
        "start_mm": [
          -20,
          0
        ],
        "end_mm": [
          20,
          0
        ],
        "thickness_mm": 2,
        "height_mm": 8
      }
    ]
  },
  {
    "spec_version": "4.3",
    "name": "Plate with an adjustment slot",
    "features": [
      {
        "id": "base",
        "type": "plate",
        "outline": {
          "kind": "rectangle",
          "width_mm": 60,
          "length_mm": 40
        },
        "thickness_mm": 4,
        "placement": {
          "anchor": "origin"
        }
      },
      {
        "id": "slot_1",
        "type": "slot",
        "plate": "base",
        "position_mm": [
          0,
          0
        ],
        "length_mm": 24,
        "width_mm": 6.5,
        "angle_deg": 0
      }
    ]
  },
  {
    "spec_version": "4.3",
    "name": "Plate with a standoff",
    "features": [
      {
        "id": "base",
        "type": "plate",
        "outline": {
          "kind": "rectangle",
          "width_mm": 60,
          "length_mm": 40
        },
        "thickness_mm": 4,
        "placement": {
          "anchor": "origin"
        }
      },
      {
        "id": "post_1",
        "type": "standoff",
        "plate": "base",
        "position_mm": [
          10,
          0
        ],
        "outer_diameter_mm": 8,
        "height_mm": 10,
        "hole_diameter_mm": 3.2
      }
    ]
  },
  {
    "spec_version": "4.3",
    "name": "Round plate with center hole",
    "features": [
      {
        "id": "base",
        "type": "plate",
        "outline": {
          "kind": "circle",
          "diameter_mm": 50
        },
        "thickness_mm": 5,
        "placement": {
          "anchor": "origin"
        }
      },
      {
        "id": "center_hole",
        "type": "hole",
        "plate": "base",
        "position_mm": [
          0,
          0
        ],
        "diameter_mm": 12
      }
    ]
  },
  {
    "spec_version": "4.3",
    "name": "Open box",
    "features": [
      {
        "id": "box",
        "type": "body",
        "placement": {
          "anchor": "origin"
        },
        "shape": {
          "kind": "extrude",
          "outline": {
            "kind": "rectangle",
            "width_mm": 60,
            "length_mm": 40,
            "corner_radius_mm": 4
          },
          "height_mm": 30
        },
        "shell": {
          "wall_thickness_mm": 2,
          "open": "top"
        }
      }
    ]
  },
  {
    "spec_version": "4.3",
    "name": "Solid knob",
    "features": [
      {
        "id": "knob",
        "type": "body",
        "placement": {
          "anchor": "origin"
        },
        "shape": {
          "kind": "extrude",
          "outline": {
            "kind": "circle",
            "diameter_mm": 30
          },
          "height_mm": 20
        },
        "edge_fillet_mm": 2
      }
    ]
  },
  {
    "spec_version": "4.3",
    "name": "Grooved round vase",
    "features": [
      {
        "id": "vase",
        "type": "body",
        "placement": {
          "anchor": "origin"
        },
        "shape": {
          "kind": "revolve",
          "profile_mm": [
            [
              30,
              0
            ],
            [
              40,
              60
            ],
            [
              32,
              140
            ],
            [
              22,
              190
            ],
            [
              26,
              200
            ]
          ]
        },
        "shell": {
          "wall_thickness_mm": 3,
          "open": "top"
        },
        "texture": {
          "kind": "grooves",
          "width_mm": 3,
          "depth_mm": 1.5,
          "spacing_mm": 12,
          "z_range_mm": [
            20,
            170
          ]
        }
      }
    ]
  },
  {
    "spec_version": "4.3",
    "name": "Tapered knob",
    "features": [
      {
        "id": "knob",
        "type": "body",
        "placement": {
          "anchor": "origin"
        },
        "shape": {
          "kind": "revolve",
          "profile_mm": [
            [
              18,
              0
            ],
            [
              18,
              4
            ],
            [
              14,
              22
            ],
            [
              12,
              30
            ]
          ]
        },
        "edge_fillet_mm": 1.5
      }
    ]
  },
  {
    "spec_version": "4.3",
    "name": "Round vase",
    "features": [
      {
        "id": "vase",
        "type": "body",
        "placement": {
          "anchor": "origin"
        },
        "shape": {
          "kind": "revolve",
          "profile_mm": [
            [
              30,
              0
            ],
            [
              40,
              60
            ],
            [
              32,
              140
            ],
            [
              22,
              190
            ],
            [
              26,
              200
            ]
          ]
        },
        "shell": {
          "wall_thickness_mm": 2.5,
          "open": "top"
        }
      }
    ]
  },
  {
    "spec_version": "4.3",
    "name": "Ridged square vase",
    "features": [
      {
        "id": "vase",
        "type": "body",
        "placement": {
          "anchor": "origin"
        },
        "shape": {
          "kind": "extrude",
          "outline": {
            "kind": "rectangle",
            "width_mm": 80,
            "length_mm": 80,
            "corner_radius_mm": 6
          },
          "height_mm": 200
        },
        "shell": {
          "wall_thickness_mm": 2.5,
          "open": "top"
        },
        "texture": {
          "kind": "ridges",
          "width_mm": 4,
          "depth_mm": 1,
          "spacing_mm": 10
        }
      }
    ]
  },
  {
    "spec_version": "4.3",
    "name": "Square vase",
    "features": [
      {
        "id": "vase",
        "type": "body",
        "placement": {
          "anchor": "origin"
        },
        "shape": {
          "kind": "extrude",
          "outline": {
            "kind": "rectangle",
            "width_mm": 80,
            "length_mm": 80,
            "corner_radius_mm": 6
          },
          "height_mm": 200
        },
        "shell": {
          "wall_thickness_mm": 2,
          "open": "top"
        },
        "edge_fillet_mm": 1
      }
    ]
  },
  {
    "spec_version": "4.3",
    "name": "Fluted shift knob",
    "features": [
      {
        "id": "knob",
        "type": "body",
        "placement": {
          "anchor": "origin"
        },
        "shape": {
          "kind": "extrude",
          "outline": {
            "kind": "circle",
            "diameter_mm": 60
          },
          "height_mm": 35
        },
        "edge_fillet_top_mm": 4,
        "texture": {
          "kind": "grooves",
          "width_mm": 2,
          "depth_mm": 1,
          "spacing_mm": 7.85
        },
        "bores": [
          {
            "diameter_mm": 8.8,
            "depth_mm": 20,
            "from": "bottom"
          }
        ]
      }
    ]
  },
  {
    "spec_version": "4.3",
    "name": "Curved bracket with a drilled cross hole",
    "features": [
      {
        "id": "profile",
        "type": "sketch",
        "plane": {
          "name": "XY"
        },
        "shapes": [
          {
            "outer": {
              "kind": "path",
              "start_mm": [
                0,
                0
              ],
              "segments": [
                {
                  "kind": "line",
                  "to_mm": [
                    60,
                    0
                  ]
                },
                {
                  "kind": "line",
                  "to_mm": [
                    60,
                    10
                  ]
                },
                {
                  "kind": "arc",
                  "mid_mm": [
                    30,
                    20
                  ],
                  "to_mm": [
                    0,
                    10
                  ]
                }
              ]
            },
            "holes": [
              {
                "kind": "circle",
                "center_mm": [
                  10,
                  5
                ],
                "diameter_mm": 4
              }
            ]
          }
        ]
      },
      {
        "id": "bracket",
        "type": "extrude",
        "sketch": "profile",
        "distance_mm": 8
      },
      {
        "id": "cross_hole_sketch",
        "type": "sketch",
        "plane": {
          "name": "XZ"
        },
        "shapes": [
          {
            "outer": {
              "kind": "circle",
              "center_mm": [
                40,
                4
              ],
              "diameter_mm": 6
            }
          }
        ]
      },
      {
        "id": "drilled",
        "type": "extrude",
        "sketch": "cross_hole_sketch",
        "distance_mm": 50,
        "direction": "reverse",
        "operation": "cut",
        "target": "bracket"
      }
    ]
  },
  {
    "spec_version": "4.3",
    "name": "Spline vase, revolved",
    "features": [
      {
        "id": "profile",
        "type": "sketch",
        "plane": {
          "name": "XZ"
        },
        "shapes": [
          {
            "outer": {
              "kind": "path",
              "start_mm": [
                0,
                0
              ],
              "segments": [
                {
                  "kind": "line",
                  "to_mm": [
                    30,
                    0
                  ]
                },
                {
                  "kind": "spline",
                  "through_mm": [
                    [
                      42,
                      40
                    ],
                    [
                      28,
                      90
                    ],
                    [
                      34,
                      140
                    ]
                  ]
                },
                {
                  "kind": "line",
                  "to_mm": [
                    31,
                    140
                  ]
                },
                {
                  "kind": "spline",
                  "through_mm": [
                    [
                      25,
                      90
                    ],
                    [
                      39,
                      40
                    ],
                    [
                      27,
                      3
                    ]
                  ]
                },
                {
                  "kind": "line",
                  "to_mm": [
                    0,
                    3
                  ]
                }
              ]
            }
          }
        ]
      },
      {
        "id": "vase",
        "type": "revolve",
        "sketch": "profile"
      }
    ]
  },
  {
    "spec_version": "4.3",
    "name": "Star plate with a bore, mirrored pair",
    "features": [
      {
        "id": "outline",
        "type": "sketch",
        "plane": {
          "name": "XY"
        },
        "shapes": [
          {
            "outer": {
              "kind": "polygon",
              "points_mm": [
                [
                  30,
                  0
                ],
                [
                  12,
                  8
                ],
                [
                  9,
                  28
                ],
                [
                  -4,
                  13
                ],
                [
                  -24,
                  18
                ],
                [
                  -14,
                  0
                ],
                [
                  -24,
                  -18
                ],
                [
                  -4,
                  -13
                ],
                [
                  9,
                  -28
                ],
                [
                  12,
                  -8
                ]
              ]
            },
            "holes": [
              {
                "kind": "ellipse",
                "center_mm": [
                  0,
                  0
                ],
                "major_mm": 14,
                "minor_mm": 8
              }
            ]
          }
        ]
      },
      {
        "id": "star",
        "type": "extrude",
        "sketch": "outline",
        "distance_mm": 6,
        "direction": "symmetric"
      },
      {
        "id": "star_back",
        "type": "transform",
        "source": "star",
        "mirror": {
          "plane": "YZ",
          "offset_mm": 45
        },
        "copy": true
      }
    ]
  },
  {
    "spec_version": "4.3",
    "name": "Bent pipe from two sweeps",
    "features": [
      {
        "id": "route",
        "type": "curve",
        "plane": {
          "name": "XZ"
        },
        "start_mm": [
          0,
          0
        ],
        "segments": [
          {
            "kind": "line",
            "to_mm": [
              0,
              40
            ]
          },
          {
            "kind": "arc",
            "mid_mm": [
              10.6,
              60.6
            ],
            "to_mm": [
              30,
              70
            ]
          },
          {
            "kind": "line",
            "to_mm": [
              70,
              70
            ]
          }
        ]
      },
      {
        "id": "outer_profile",
        "type": "sketch",
        "plane": {
          "name": "XY",
          "offset_mm": 0
        },
        "shapes": [
          {
            "outer": {
              "kind": "circle",
              "diameter_mm": 14
            }
          }
        ]
      },
      {
        "id": "bore_profile",
        "type": "sketch",
        "plane": {
          "name": "XY",
          "offset_mm": 0
        },
        "shapes": [
          {
            "outer": {
              "kind": "circle",
              "diameter_mm": 10
            }
          }
        ]
      },
      {
        "id": "outer",
        "type": "sweep",
        "profile": "outer_profile",
        "path": "route"
      },
      {
        "id": "bore",
        "type": "sweep",
        "profile": "bore_profile",
        "path": "route"
      },
      {
        "id": "pipe",
        "type": "boolean",
        "operation": "cut",
        "target": "outer",
        "tools": [
          "bore"
        ]
      }
    ]
  },
  {
    "spec_version": "4.3",
    "name": "Bottle lofted through three sections",
    "features": [
      {
        "id": "s_base",
        "type": "sketch",
        "plane": {
          "name": "XY",
          "offset_mm": 0
        },
        "shapes": [
          {
            "outer": {
              "kind": "circle",
              "diameter_mm": 44
            }
          }
        ]
      },
      {
        "id": "s_mid",
        "type": "sketch",
        "plane": {
          "name": "XY",
          "offset_mm": 30
        },
        "shapes": [
          {
            "outer": {
              "kind": "rectangle",
              "width_mm": 34,
              "height_mm": 34
            }
          }
        ]
      },
      {
        "id": "s_neck",
        "type": "sketch",
        "plane": {
          "name": "XY",
          "offset_mm": 70
        },
        "shapes": [
          {
            "outer": {
              "kind": "circle",
              "diameter_mm": 18
            }
          }
        ]
      },
      {
        "id": "body",
        "type": "loft",
        "sketches": [
          "s_base",
          "s_mid",
          "s_neck"
        ]
      }
    ]
  },
  {
    "spec_version": "4.3",
    "name": "Block with rounded corners and a bevelled top",
    "features": [
      {
        "id": "base",
        "type": "sketch",
        "plane": {
          "name": "XY"
        },
        "shapes": [
          {
            "outer": {
              "kind": "rectangle",
              "width_mm": 50,
              "height_mm": 30
            }
          }
        ]
      },
      {
        "id": "block",
        "type": "extrude",
        "sketch": "base",
        "distance_mm": 20
      },
      {
        "id": "rounded",
        "type": "fillet_edges",
        "solid": "block",
        "edges": [
          {
            "parallel": "Z"
          }
        ],
        "radius_mm": 5
      },
      {
        "id": "finished",
        "type": "chamfer_edges",
        "solid": "rounded",
        "edges": [
          {
            "on_face": "top"
          }
        ],
        "distance_mm": 1.5
      }
    ]
  },
  {
    "spec_version": "4.3",
    "name": "Flange with a circular pattern of bolt holes",
    "features": [
      {
        "id": "disk",
        "type": "sketch",
        "plane": {
          "name": "XY",
          "offset_mm": 0
        },
        "shapes": [
          {
            "outer": {
              "kind": "circle",
              "diameter_mm": 90
            }
          }
        ]
      },
      {
        "id": "plate",
        "type": "extrude",
        "sketch": "disk",
        "distance_mm": 8
      },
      {
        "id": "bolt",
        "type": "sketch",
        "plane": {
          "name": "XY",
          "offset_mm": -1
        },
        "shapes": [
          {
            "outer": {
              "kind": "circle",
              "diameter_mm": 6.6,
              "center_mm": [
                30,
                0
              ]
            }
          }
        ]
      },
      {
        "id": "hole",
        "type": "extrude",
        "sketch": "bolt",
        "distance_mm": 10
      },
      {
        "id": "holes",
        "type": "circular_pattern",
        "source": "hole",
        "count": 6,
        "axis_point_mm": [
          0,
          0,
          0
        ],
        "axis_dir": [
          0,
          0,
          1
        ]
      },
      {
        "id": "flange",
        "type": "boolean",
        "operation": "cut",
        "target": "plate",
        "tools": [
          "holes"
        ]
      }
    ]
  },
  {
    "spec_version": "4.3",
    "name": "Open tray from a hollowed block",
    "features": [
      {
        "id": "base",
        "type": "sketch",
        "plane": {
          "name": "XY",
          "offset_mm": 0
        },
        "shapes": [
          {
            "outer": {
              "kind": "rectangle",
              "width_mm": 80,
              "height_mm": 50
            }
          }
        ]
      },
      {
        "id": "block",
        "type": "extrude",
        "sketch": "base",
        "distance_mm": 20
      },
      {
        "id": "tray",
        "type": "hollow",
        "solid": "block",
        "thickness_mm": 2.5,
        "open_sides": [
          "top"
        ]
      }
    ]
  },
  {
    "spec_version": "4.3",
    "name": "Bracket drawn on one side and mirrored",
    "features": [
      {
        "id": "half",
        "type": "sketch",
        "plane": {
          "name": "XZ",
          "offset_mm": 0
        },
        "shapes": [
          {
            "outer": {
              "kind": "polygon",
              "points_mm": [
                [
                  0,
                  0
                ],
                [
                  40,
                  0
                ],
                [
                  40,
                  10
                ],
                [
                  10,
                  10
                ],
                [
                  10,
                  50
                ],
                [
                  0,
                  50
                ]
              ]
            }
          }
        ]
      },
      {
        "id": "side",
        "type": "extrude",
        "sketch": "half",
        "distance_mm": 25,
        "direction": "symmetric"
      },
      {
        "id": "bracket",
        "type": "mirror",
        "source": "side",
        "plane": "YZ"
      }
    ]
  },
  {
    "spec_version": "4.3",
    "name": "Older open box with a boss added and a hole drilled by CAD features",
    "features": [
      {
        "id": "box",
        "type": "body",
        "placement": {
          "anchor": "origin"
        },
        "shape": {
          "kind": "extrude",
          "outline": {
            "kind": "rectangle",
            "width_mm": 60,
            "length_mm": 40
          },
          "height_mm": 30
        }
      },
      {
        "id": "boss_sk",
        "type": "sketch",
        "plane": {
          "name": "XY",
          "offset_mm": 30
        },
        "shapes": [
          {
            "outer": {
              "kind": "circle",
              "diameter_mm": 16
            }
          }
        ]
      },
      {
        "id": "boss",
        "type": "extrude",
        "sketch": "boss_sk",
        "distance_mm": 10
      },
      {
        "id": "hole_sk",
        "type": "sketch",
        "plane": {
          "name": "XY",
          "offset_mm": -1
        },
        "shapes": [
          {
            "outer": {
              "kind": "circle",
              "diameter_mm": 6
            }
          }
        ]
      },
      {
        "id": "drill",
        "type": "extrude",
        "sketch": "hole_sk",
        "distance_mm": 50
      },
      {
        "id": "joined",
        "type": "boolean",
        "operation": "union",
        "target": "box",
        "tools": [
          "boss"
        ]
      },
      {
        "id": "part",
        "type": "boolean",
        "operation": "cut",
        "target": "joined",
        "tools": [
          "drill"
        ]
      }
    ]
  },
  {
    "spec_version": "4.3",
    "name": "Housing with 3 degree draft on its sides",
    "features": [
      {
        "id": "base",
        "type": "sketch",
        "plane": {
          "name": "XY",
          "offset_mm": 0
        },
        "shapes": [
          {
            "outer": {
              "kind": "rectangle",
              "width_mm": 60,
              "height_mm": 40
            }
          }
        ]
      },
      {
        "id": "block",
        "type": "extrude",
        "sketch": "base",
        "distance_mm": 30
      },
      {
        "id": "tapered",
        "type": "draft",
        "solid": "block",
        "angle_deg": 3,
        "faces": "sides"
      },
      {
        "id": "housing",
        "type": "hollow",
        "solid": "tapered",
        "thickness_mm": 2,
        "open_sides": [
          "top"
        ]
      }
    ]
  },
  {
    "spec_version": "4.3",
    "name": "Wing from side and front outlines",
    "features": [
      {
        "id": "plate_sk_l",
        "type": "sketch",
        "plane": {
          "name": "YZ",
          "offset_mm": -500
        },
        "shapes": [
          {
            "outer": {
              "kind": "path",
              "start_mm": [
                -120,
                0
              ],
              "segments": [
                {
                  "kind": "line",
                  "to_mm": [
                    110,
                    0
                  ]
                },
                {
                  "kind": "spline",
                  "through_mm": [
                    [
                      130,
                      40
                    ],
                    [
                      140,
                      110
                    ],
                    [
                      132,
                      150
                    ]
                  ]
                },
                {
                  "kind": "spline",
                  "through_mm": [
                    [
                      60,
                      150
                    ],
                    [
                      -60,
                      138
                    ],
                    [
                      -130,
                      122
                    ]
                  ]
                }
              ]
            }
          }
        ]
      },
      {
        "id": "plate_l",
        "type": "extrude",
        "sketch": "plate_sk_l",
        "distance_mm": 6
      },
      {
        "id": "plate_sk_r",
        "type": "sketch",
        "plane": {
          "name": "YZ",
          "offset_mm": 494
        },
        "shapes": [
          {
            "outer": {
              "kind": "path",
              "start_mm": [
                -120,
                0
              ],
              "segments": [
                {
                  "kind": "line",
                  "to_mm": [
                    110,
                    0
                  ]
                },
                {
                  "kind": "spline",
                  "through_mm": [
                    [
                      130,
                      40
                    ],
                    [
                      140,
                      110
                    ],
                    [
                      132,
                      150
                    ]
                  ]
                },
                {
                  "kind": "spline",
                  "through_mm": [
                    [
                      60,
                      150
                    ],
                    [
                      -60,
                      138
                    ],
                    [
                      -130,
                      122
                    ]
                  ]
                }
              ]
            }
          }
        ]
      },
      {
        "id": "plate_r",
        "type": "extrude",
        "sketch": "plate_sk_r",
        "distance_mm": 6
      },
      {
        "id": "blade_sk",
        "type": "sketch",
        "plane": {
          "name": "YZ",
          "offset_mm": -497
        },
        "shapes": [
          {
            "outer": {
              "kind": "polygon",
              "points_mm": [
                [
                  -120,
                  95
                ],
                [
                  120,
                  110
                ],
                [
                  120,
                  114
                ],
                [
                  -120,
                  99
                ]
              ]
            }
          }
        ]
      },
      {
        "id": "blade",
        "type": "extrude",
        "sketch": "blade_sk",
        "distance_mm": 994
      },
      {
        "id": "cradle_sk",
        "type": "sketch",
        "plane": {
          "name": "XZ",
          "offset_mm": 110
        },
        "shapes": [
          {
            "outer": {
              "kind": "path",
              "start_mm": [
                -497,
                0
              ],
              "segments": [
                {
                  "kind": "spline",
                  "through_mm": [
                    [
                      -300,
                      25
                    ],
                    [
                      0,
                      40
                    ],
                    [
                      300,
                      25
                    ],
                    [
                      497,
                      0
                    ]
                  ]
                },
                {
                  "kind": "line",
                  "to_mm": [
                    497,
                    60
                  ]
                },
                {
                  "kind": "spline",
                  "through_mm": [
                    [
                      300,
                      70
                    ],
                    [
                      0,
                      75
                    ],
                    [
                      -300,
                      70
                    ],
                    [
                      -497,
                      60
                    ]
                  ]
                }
              ]
            }
          }
        ]
      },
      {
        "id": "cradle",
        "type": "extrude",
        "sketch": "cradle_sk",
        "distance_mm": 10
      },
      {
        "id": "wing",
        "type": "boolean",
        "operation": "union",
        "target": "plate_l",
        "tools": [
          "plate_r",
          "blade",
          "cradle"
        ]
      }
    ]
  }
];
