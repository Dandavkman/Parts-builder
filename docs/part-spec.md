# Part Spec v1

A Part Spec is a JSON description of one part. The design agent writes it, our own tested code (the spec builder, task B1.7) turns it into exact CAD, and the web app shows its numbers as sliders. The schema is `services/geometry/src/geometry/spec/part-spec.schema.json`, the single source of truth. TypeScript types are generated from it with `pnpm generate`.

```json
{ "spec_version": "1.0", "name": "My part", "features": [ { "id": "base", "type": "plate", "...": "..." } ] }
```

## Ground rules

- **Units.** Lengths are millimeters, angles are degrees. Never put another unit in a spec.
- **Ids.** Every feature has an `id` (lowercase letters, digits and `_`, starting with a letter, at most 40 characters). Ids are unique within a spec. Other features refer to a plate by its id.
- **Plate-local coordinates.** Each plate has its own frame. The origin is the plate center. X runs along the width, Y along the length, and Z through the thickness. The plate's middle plane is Z = 0 and its top face is Z = +thickness/2. Every `position_mm` is `[x, y]` in this frame, measured from the plate center.
- **Placement and anchors.** A plate's `placement` says where the plate sits: `anchor` is the id of an anchor picked on the scan, or the reserved name `origin` for the part's own origin, and `offset_mm` is `[x, y, z]` in that anchor's frame. For plane, hole and axis anchors the frame's Z points along the anchor's normal or axis, and the plate's middle plane lies on the anchor. A part never contains absolute positions without an anchor.
- **Order.** All plates are built first. Then `fillet` and `chamfer` shape each plate's outline, before anything else. The remaining features are applied in the order listed. A hole cuts through everything at its position, so a hole listed after a `standoff` also cuts the standoff.
- **What the schema cannot check.** The builder (B1.7) also checks that ids are unique, that referenced plates and anchors exist, and that every feature fits inside its plate. It reports each problem with the feature id, for example `hole hole_2 is outside plate base`.

## Versions

`"1.0"` is current. Specs written for `"0.1"` stay valid and buildable, but a `"0.1"` spec may only use `plate` (rectangle), `hole` and `hole_pattern`. Any change to the schema bumps the version and keeps older specs buildable. Valid `spec_version` values are `"0.1"` and `"1.0"`.

## Features

Every field is required unless a default is shown. Complete example specs for every feature are in `services/geometry/src/geometry/spec/examples/`.

### `plate`

The base solid. A part has one or more plates.

| Field | Meaning |
| --- | --- |
| `thickness_mm` | Plate thickness |
| `placement` | `{ "anchor": "origin", "offset_mm": [0, 0, 0] }` |
| `width_mm` and `length_mm` | A rectangle. Use these or `outline_mm`, not both |
| `outline_mm` | A polygon of 3 to 64 `[x, y]` points in plate-local coordinates |

Examples: `plate-with-two-holes.json` (rectangle), `feature-plate-outline.json` (polygon).

### `hole`

A round hole through the plate.

| Field | Meaning |
| --- | --- |
| `plate` | Id of the plate |
| `diameter_mm` | Hole diameter |
| `position_mm` | `[x, y]` of the center |
| `align_anchor` (optional) | Id of a hole anchor on the scan that this hole should line up with. The fit check reports how far apart they are |

Example: `plate-with-two-holes.json`.

### `hole_pattern`

Several identical holes in a grid or a circle.

| Field | Meaning |
| --- | --- |
| `plate`, `diameter_mm` | As for `hole` |
| `pattern` | `{ "kind": "rectangular", "count_x", "count_y", "spacing_x_mm", "spacing_y_mm", "center_mm" }` or `{ "kind": "circular", "count", "radius_mm", "start_angle_deg", "center_mm" }`. `center_mm` defaults to `[0, 0]` and `start_angle_deg` to 0 |

Example: `plate-with-hole-patterns.json`.

### `counterbore`

A hole with a flat-bottomed wider recess from the top face, for a bolt head.

| Field | Meaning |
| --- | --- |
| `plate` | Id of the plate |
| `diameter_mm` | Through-hole diameter |
| `cbore_diameter_mm` | Recess diameter. Must be larger than `diameter_mm` |
| `cbore_depth_mm` | Recess depth from the top face. Must be less than the plate thickness |
| `position_mm` | `[x, y]` of the center |
| `align_anchor` (optional) | As for `hole` |

Example: `feature-counterbore.json`.

### `countersink`

A hole with a conical recess from the top face, for a flat-head screw.

| Field | Meaning |
| --- | --- |
| `plate`, `diameter_mm`, `position_mm`, `align_anchor` | As for `counterbore` |
| `csk_diameter_mm` | Cone diameter at the top face. Must be larger than `diameter_mm` |
| `csk_angle_deg` | Full cone angle, 60 to 120. Default 90 |

Example: `feature-countersink.json`.

### `slot`

A rounded slot (two half circles joined by straight sides), cut through the plate.

| Field | Meaning |
| --- | --- |
| `plate` | Id of the plate |
| `width_mm` | Slot width (the diameter of the rounded ends) |
| `length_mm` | Overall length, end to end. Must be at least `width_mm` |
| `angle_deg` | Rotation about the center, counterclockwise from the X axis. Default 0 |
| `position_mm` | `[x, y]` of the center |

Example: `feature-slot.json`.

### `standoff`

A round post standing on the top face, optionally drilled.

| Field | Meaning |
| --- | --- |
| `plate` | Id of the plate |
| `outer_diameter_mm` | Post diameter |
| `height_mm` | Height above the top face |
| `hole_diameter_mm` (optional) | A hole through the post and the plate |
| `position_mm` | `[x, y]` of the center |

Example: `feature-standoff.json`.

### `rib`

A thin wall standing on the top face, running between two points. Use the triangle profile for a gusset.

| Field | Meaning |
| --- | --- |
| `plate` | Id of the plate |
| `thickness_mm` | Wall thickness |
| `height_mm` | Height above the top face (at `from_mm` for a triangle) |
| `from_mm`, `to_mm` | `[x, y]` start and end of the wall's center line |
| `profile` | `rectangle` (constant height) or `triangle` (full height at `from_mm`, zero at `to_mm`). Default `rectangle` |

Example: `feature-rib.json` (one of each).

### `bend`

Bends a flange up from one edge of a rectangular plate, making an L bracket.

| Field | Meaning |
| --- | --- |
| `plate` | Id of a plate with `width_mm` and `length_mm` (not an outline) |
| `edge` | `+x`, `-x`, `+y` or `-y`: which edge the flange rises from |
| `flange_length_mm` | How far the flange end sits above the plate's top face. Must be larger than `inner_radius_mm` |
| `inner_radius_mm` | Inside bend radius, 0 to 50. Default 2 |
| `angle_deg` | Always 90 |

The flange has the plate's thickness and the full width of the edge. Its outer face is flush with the plate edge. The outside bend radius is `inner_radius_mm` plus the thickness.

Example: `feature-bend.json`.

### `fillet`

Rounds the plate's outline edges. Applied to the bare plate before other features, and never to hole edges.

| Field | Meaning |
| --- | --- |
| `plate` | Id of the plate |
| `radius_mm` | Fillet radius |
| `edges` | `vertical` (the corners seen from above), `top` (top outline edges), `bottom`, or `all`. Default `vertical` |

Example: `feature-fillet.json`.

### `chamfer`

Bevels the plate's outline edges. Same rules as `fillet`.

| Field | Meaning |
| --- | --- |
| `plate` | Id of the plate |
| `size_mm` | Chamfer size (equal distance on both faces) |
| `edges` | As for `fillet` |

Example: `feature-chamfer.json`.

### `cutout`

A through cut of a shape, for clearing a nearby part of the car.

| Field | Meaning |
| --- | --- |
| `plate` | Id of the plate |
| `shape` | `{ "kind": "circle", "diameter_mm" }`, `{ "kind": "rectangle", "width_mm", "length_mm" }` or `{ "kind": "polygon", "points_mm" }` (3 to 64 points, relative to `position_mm`) |
| `angle_deg` | Rotation about `position_mm`. Default 0. Has no effect on a circle |
| `position_mm` | `[x, y]` the shape is placed at |

Example: `feature-cutout.json` (one of each shape).

### `text`

Raised or engraved text on the top face, for part numbers and labels.

| Field | Meaning |
| --- | --- |
| `plate` | Id of the plate |
| `text` | 1 to 40 printable ASCII characters |
| `size_mm` | Letter height |
| `depth_mm` | How far the text rises above (or cuts into) the top face |
| `mode` | `emboss` (raised) or `engrave` (cut in). Default `emboss` |
| `angle_deg` | Rotation about `position_mm`. Default 0 |
| `position_mm` | `[x, y]` of the text's center |

Example: `feature-text.json`.
