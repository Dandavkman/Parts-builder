# Part Spec v1.1

A Part Spec is the JSON document the design agent writes and our geometry service builds. It lists features, and each feature is placed against anchors picked on the scan. The AI never writes code or meshes (see `docs/decisions.md`).

- Schema (source of truth): `services/geometry/src/geometry/spec/part-spec.v1_1.schema.json`. The v1.0 schema (`part-spec.v1.schema.json`) is unchanged and its specs still build.
- TypeScript types: `packages/part-spec`, generated with `pnpm generate`
- Examples, one per feature: `services/geometry/src/geometry/spec/examples/v1/`. Tests validate every file, and fail if a feature has no example. 1.1 additions have examples in `examples/v1_1/`; every v1 example is also valid as a 1.1 spec.
- Spec version: `"spec_version": "1.1"`. 1.1 is 1.0 plus the `circle` plate outline. Older specs (`"1.0"`, `"0.1"`) keep validating against `part-spec.schema.json` and must stay buildable.

## Conventions

- Lengths are in millimeters (`_mm`), angles in degrees (`_deg`).
- A spec has a `name` and a list of `features`. Every feature has a unique `id` (lowercase letters, digits, underscore) and a `type`.
- Only a **plate** has a `placement`. Placement is an `anchor` id from the scan (or `origin` for the part's own origin), an `offset_mm` `[x, y, z]` from that anchor, and an optional `rotation_deg` about the anchor's normal or axis. A spec never contains absolute positions.
- Every other feature names its plate in `plate` and uses `position_mm` `[x, y]` in that plate's local frame, with the origin at the plate center. The exception is `cutout`, which has its own `placement` because it clears a zone on the scan.
- JSON Schema cannot check that referenced ids exist or that a feature fits on its plate. The spec builder (B1.7) checks both and reports clear errors.

## Features

| Type | What it makes | Key fields | Example |
| --- | --- | --- | --- |
| `plate` | A flat body. `outline` is a `rectangle` (optional `corner_radius_mm`), a `circle` (`diameter_mm`, 1.1 and later, centered on the plate origin) or a closed `polygon` of `points_mm`. | `outline`, `thickness_mm`, `placement` | [rectangle](../services/geometry/src/geometry/spec/examples/v1/plate-rounded-rectangle.json), [polygon](../services/geometry/src/geometry/spec/examples/v1/plate-polygon.json), [circle](../services/geometry/src/geometry/spec/examples/v1_1/plate-circle.json) |
| `body` | (2.0) A solid with a height: boxes, cylinders, vases, cups. `shape` is `extrude` (an `outline` like a plate's, straight up `height_mm`). Optional `shell` (`wall_thickness_mm`, `open` `top` or `none`) hollows it, optional `edge_fillet_mm` rounds the outer top and bottom edges. Frame: origin at the center of the base, Z up. | `shape`, `placement`, `shell`, `edge_fillet_mm` | [body-vase](../services/geometry/src/geometry/spec/examples/v2/body-vase.json) |
| `hole` | A through hole. | `diameter_mm`, `position_mm` | [hole](../services/geometry/src/geometry/spec/examples/v1/hole.json) |
| `hole_pattern` | Many holes, `rectangular` grid or `circular` bolt circle. | `diameter_mm`, `pattern` | [hole-pattern](../services/geometry/src/geometry/spec/examples/v1/hole-pattern.json) |
| `counterbore` | A through hole with a flat recess on the top face. | `diameter_mm`, `bore_diameter_mm`, `bore_depth_mm` | [counterbore](../services/geometry/src/geometry/spec/examples/v1/counterbore.json) |
| `countersink` | A through hole with a conical recess on the top face. | `diameter_mm`, `sink_diameter_mm`, `sink_angle_deg` (default 90) | [countersink](../services/geometry/src/geometry/spec/examples/v1/countersink.json) |
| `slot` | A through slot with rounded ends. | `length_mm` (end to end), `width_mm`, `angle_deg` | [slot](../services/geometry/src/geometry/spec/examples/v1/slot.json) |
| `standoff` | A round post on a plate face, optionally drilled. | `outer_diameter_mm`, `height_mm`, `hole_diameter_mm`, `face` | [standoff](../services/geometry/src/geometry/spec/examples/v1/standoff.json) |
| `rib` | A thin wall along a line. `profile` `rectangular` is a rib, `triangular` is a gusset that falls to zero at `end_mm`. | `start_mm`, `end_mm`, `thickness_mm`, `height_mm`, `profile`, `face` | [rib](../services/geometry/src/geometry/spec/examples/v1/rib.json), [gusset](../services/geometry/src/geometry/spec/examples/v1/gusset.json) |
| `bend` | Joins an edge of one plate to an edge of another with a rounded bend (an L-bend at 90°). The second plate's own placement is ignored. | `from_plate`, `from_edge`, `to_plate`, `to_edge`, `angle_deg`, `inner_radius_mm` | [bend](../services/geometry/src/geometry/spec/examples/v1/bend.json) |
| `fillet` | Rounds plate edges: `vertical`, `top`, `bottom` or `all`. | `edges`, `radius_mm` | [fillet](../services/geometry/src/geometry/spec/examples/v1/fillet.json) |
| `chamfer` | Bevels plate edges, same selection as fillet. | `edges`, `distance_mm` | [chamfer](../services/geometry/src/geometry/spec/examples/v1/chamfer.json) |
| `cutout` | A through cut around a clearance zone on the scan, grown by `margin_mm`. `zone` is a `circle` or `rectangle`. | `placement`, `zone`, `margin_mm` | [cutout](../services/geometry/src/geometry/spec/examples/v1/cutout.json) |
| `emboss_text` | Text raised from or engraved into a face. | `text` (up to 40 characters), `height_mm`, `depth_mm`, `mode`, `face`, `angle_deg` | [emboss-text](../services/geometry/src/geometry/spec/examples/v1/emboss-text.json) |

## Building a spec

`geometry.builder.build_part(spec, anchors)` turns a spec of any released version (0.1, 1.0 or 1.1) into a CadQuery compound; `export_bytes(part, "step" | "stl" | "glb")` writes it. Same spec and anchors always give the same bytes. Problems come back as one `SpecError` listing every issue, such as `hole 'hole_2' at [29, 0] mm is outside plate 'base'`.

- **Plate frame:** a plate is centered on its local origin in X and Y, with its mid-plane at Z = 0 (top face at +thickness/2).
- **Placement:** the plate's Z axis is set to the anchor normal, then `rotation_deg` turns it about that normal, then `offset_mm` is applied along the rotated axes. `anchors` maps anchor ids to `Anchor(point_mm, normal)`; `origin` is built in.
- **Order:** per plate, fillets and chamfers first (so they only see outline edges), then additions (standoffs, ribs), then cuts (holes, patterns, slots, counterbores, countersinks, standoff bores, cutouts), then text, each group in spec order. Then bends fuse plates together and each plate moves onto its anchor.
- **Fit checks:** holes and slots must lie fully inside the plate outline. Rounded rectangle corners are treated as square for this check.
- **Features that need a note:**
  - **countersink:** `sink_angle_deg` is the full cone angle; the cone must be shallower than the plate.
  - **counterbore:** `bore_depth_mm` must be less than the plate thickness.
  - **standoff / rib:** grow from the chosen face and are fused to the plate. A standoff bore goes through the post and the plate.
  - **bend:** both plates must be plain rectangles of the same thickness, and the two joined edges must be the same length. The to-plate is placed by the bend (its own placement is ignored), the bend curves toward the from-plate's top face, and `angle_deg` is the turn (90 = an L). A plate can be bent on once, and a bent-on plate cannot start another bend (no chains yet). Cutouts are not supported on a bent-on plate.
  - **cutout:** its `placement` is in the same anchor space as plate placements, cuts straight through the plate along the anchor normal, and fails with "does not touch plate" if the zone misses it.
  - **emboss_text:** uses the bundled DejaVu Sans Bold. `height_mm` is the capital letter height. Text is checked to lie inside the plate. `angle_deg` turns the text from the plate's +X toward +Y, seen from the face it is on.

## Building over HTTP

`POST /build?format=step|stl|glb` on the geometry service takes `{"spec": ..., "anchors": {"id": {"point_mm": [x, y, z], "normal": [x, y, z]}}}` and returns the file with `Content-Disposition: attachment` and a filename made from the spec name. A spec that cannot be built returns 422 with `{"errors": ["..."]}`, one plain sentence per problem. The web app calls this; browsers never do.

## Changing the schema

Any change bumps `spec_version` and adds a new schema file next to the old ones. Never edit a released schema, so older specs stay buildable. Add an example for every new feature, run `pnpm generate`, and add a line to `docs/decisions.md`.

## Version 2.0: solid bodies

`part-spec.v2.schema.json` is 1.1 plus the `body` feature (task B1.17). A body is a solid with a height, where a plate is a flat slab. A spec may mix plates and bodies; features such as holes still refer to a plate. Examples are in `examples/v2/`, and every v1 example is also a valid 2.0 spec when its version is bumped (tested). The agent still writes 1.1 until the whole of B1.17 is built and the geometry service on Fly is redeployed. Revolved profiles and surface texture follow in B1.17b and B1.17c.
