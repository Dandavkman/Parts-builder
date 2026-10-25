/* Generated from services/geometry/src/geometry/spec (part-spec.v1.schema.json and examples/v1). Do not edit. Run `pnpm generate`. */
export const PART_SPEC_V1_SCHEMA: Record<string, unknown> = {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://parts-builder.local/schemas/part-spec.v1.json",
  "title": "PartSpecV1",
  "description": "Part Spec v1. A part described as features positioned against anchors. All lengths are in millimeters and all angles in degrees. Features other than plates refer to a plate by id; the spec builder checks that the ids exist.",
  "type": "object",
  "additionalProperties": false,
  "required": [
    "spec_version",
    "name",
    "features"
  ],
  "properties": {
    "spec_version": {
      "const": "1.0"
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
      "description": "A point [x, y] in millimeters in the plate's local frame, origin at the plate center.",
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
    }
  }
};

export const PART_SPEC_V1_EXAMPLES: Record<string, unknown>[] = [
  {
    "spec_version": "1.0",
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
    "spec_version": "1.0",
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
    "spec_version": "1.0",
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
    "spec_version": "1.0",
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
    "spec_version": "1.0",
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
    "spec_version": "1.0",
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
    "spec_version": "1.0",
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
    "spec_version": "1.0",
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
    "spec_version": "1.0",
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
    "spec_version": "1.0",
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
    "spec_version": "1.0",
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
    "spec_version": "1.0",
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
    "spec_version": "1.0",
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
    "spec_version": "1.0",
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
    "spec_version": "1.0",
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
  }
];
