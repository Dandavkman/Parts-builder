# Part Spec v1

A Part Spec is the JSON document the design agent writes and our geometry service builds. It lists features, and each feature is placed against anchors picked on the scan. The AI never writes code or meshes (see `docs/decisions.md`).

- Schema (source of truth): `services/geometry/src/geometry/spec/part-spec.v1.schema.json`
- TypeScript types: `packages/part-spec`, generated with `pnpm generate`
- Examples, one per feature: `services/geometry/src/geometry/spec/examples/v1/`. Tests validate every file, and fail if a feature has no example.
- Spec version: `"spec_version": "1.0"`. Older specs (`"0.1"`) keep validating against `part-spec.schema.json` and must stay buildable.

## Conventions

- Lengths are in millimeters (`_mm`), angles in degrees (`_deg`).
- A spec has a `name` and a list of `features`. Every feature has a unique `id` (lowercase letters, digits, underscore) and a `type`.
- Only a **plate** has a `placement`. Placement is an `anchor` id from the scan (or `origin` for the part's own origin), an `offset_mm` `[x, y, z]` from that anchor, and an optional `rotation_deg` about the anchor's normal or axis. A spec never contains absolute positions.
- Every other feature names its plate in `plate` and uses `position_mm` `[x, y]` in that plate's local frame, with the origin at the plate center. The exception is `cutout`, which has its own `placement` because it clears a zone on the scan.
- JSON Schema cannot check that referenced ids exist or that a feature fits on its plate. The spec builder (B1.7) checks both and reports clear errors.

## Features

| Type | What it makes | Key fields | Example |
| --- | --- | --- | --- |
| `plate` | A flat body. `outline` is a `rectangle` (optional `corner_radius_mm`) or a closed `polygon` of `points_mm`. | `outline`, `thickness_mm`, `placement` | [rectangle](../services/geometry/src/geometry/spec/examples/v1/plate-rounded-rectangle.json), [polygon](../services/geometry/src/geometry/spec/examples/v1/plate-polygon.json) |
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

`geometry.builder.build_part(spec, anchors)` turns a spec of any released version (0.1 or 1.0) into a CadQuery compound; `export_bytes(part, "step" | "stl" | "glb")` writes it. Same spec and anchors always give the same bytes. Problems come back as one `SpecError` listing every issue, such as `hole 'hole_2' at [29, 0] mm is outside plate 'base'`.

- **Plate frame:** a plate is centered on its local origin in X and Y, with its mid-plane at Z = 0 (top face at +thickness/2).
- **Placement:** the plate's Z axis is set to the anchor normal, then `rotation_deg` turns it about that normal, then `offset_mm` is applied along the rotated axes. `anchors` maps anchor ids to `Anchor(point_mm, normal)`; `origin` is built in.
- **Order:** per plate, fillets and chamfers first, then cuts (holes, patterns, slots), each in spec order. Edge finishes come first so they only see outline edges.
- **Fit checks:** holes and slots must lie fully inside the plate outline. Rounded rectangle corners are treated as square for this check.
- **Buildable now (B1.7a):** plate, hole, hole_pattern, slot, fillet, chamfer. The rest give "not buildable yet" until B1.7b.

## Changing the schema

Any change bumps `spec_version` and adds a new schema file next to the old ones. Never edit a released schema, so older specs stay buildable. Add an example for every new feature, run `pnpm generate`, and add a line to `docs/decisions.md`.
