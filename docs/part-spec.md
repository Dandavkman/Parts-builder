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
| `body` | (2.0) A solid with a height: boxes, cylinders, vases, cups. `shape` is `extrude` (an `outline` like a plate's, straight up `height_mm`) or `revolve` (`profile_mm`, a list of `[radius, z]` points of the outside from base to rim, z strictly increasing, spun about the Z axis). Optional `shell` (`wall_thickness_mm`, `open` `top` or `none`) hollows it, optional `edge_fillet_mm` rounds the outer top and bottom edges, optional `texture` (`ridges` or `grooves`: `width_mm`, `depth_mm`, `spacing_mm`, optional `z_range_mm`) adds vertical stripes on the outside wall of rectangle and circle extrusions and revolved bodies. Frame: origin at the center of the base, Z up. | `shape`, `placement`, `shell`, `edge_fillet_mm`, `texture`, (2.1) `edge_fillet_top_mm`, `edge_fillet_bottom_mm`, `bores` | [body-vase](../services/geometry/src/geometry/spec/examples/v2/body-vase.json), [body-revolve-vase](../services/geometry/src/geometry/spec/examples/v2/body-revolve-vase.json), [body-ridged-vase](../services/geometry/src/geometry/spec/examples/v2/body-ridged-vase.json), [body-grooved-vase](../services/geometry/src/geometry/spec/examples/v2/body-grooved-vase.json) |
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

`part-spec.v2.schema.json` is 1.1 plus the `body` feature (task B1.17). A body is a solid with a height, where a plate is a flat slab. A spec may mix plates and bodies; features such as holes still refer to a plate. Examples are in `examples/v2/`, and every v1 example is also a valid 2.0 spec when its version is bumped (tested). Revolved profiles are in (B1.17b). Surface texture is in (B1.17c). The agent writes 1.1 by default. Setting `DESIGN_AGENT_SPEC_VERSION=2.0` in Vercel (B1.17d) makes it write 2.0 instead; do that only after the Fly geometry service has been redeployed with `fly deploy`, and leave it empty to go back.

## Version 2.1: blind bores and separate round-overs

`part-spec.v2_1.schema.json` is 2.0 plus two body options (task B1.22); every 2.0 spec stays buildable and is valid as 2.1 once its version is bumped (tested). A body may carry `bores`, a list of blind holes along Z: `diameter_mm`, `depth_mm`, `from` (`bottom` or `top`) and optional `position_mm` (default: center). A bore may be as deep as the body but must leave at least 1.2 mm of wall around it, and cannot be combined with `shell`. `edge_fillet_top_mm` and `edge_fillet_bottom_mm` round one edge each; `edge_fillet_mm` still rounds both and cannot be mixed with them. A threaded hole is modelled as a tap-drill hole (8.8 mm for M10x1.25); the model has no cut threads. Example: [body-fluted-knob](../services/geometry/src/geometry/spec/examples/v2_1/body-fluted-knob.json). The agent writes 2.1 when `DESIGN_AGENT_SPEC_VERSION=2.1`, after `fly deploy`.

## Version 3.0: swept tubes and merges

`part-spec.v3.schema.json` is 2.1 plus two features (turbo manifold support, phase 2a); every 2.1 spec stays buildable and is valid as 3.0 once its version is bumped (tested). Examples are in `examples/v3/`. The agent still writes 2.1 until the prompt is updated (phase 5) and the Fly service has been redeployed.

| Type | What it makes | Key fields |
| --- | --- | --- |
| `tube` | A round pipe swept along a 3D path. `path_mm` is a list of `[x, y, z]` corner points in the part frame (2 to 64). Each corner is rounded with an arc of `bend_radius_mm` (centerline radius, default 1.5 times `outer_diameter_mm`). `wall_thickness_mm` makes it hollow with open ends; leave it out for a solid rod. | `path_mm`, `outer_diameter_mm`, `wall_thickness_mm`, `bend_radius_mm`, `placement` |
| `merge` | Fuses two or more overlapping tubes into one solid, then cuts every tube's bore out of the result so the passages join (runners meeting in a collector). Merged tubes are not built separately; a tube can be in only one merge. | `tubes` (ids) |

Checks, each with a plain error: path points must differ, the path must not double back, `bend_radius_mm` must be larger than the tube radius, each straight run must be long enough for the bends at its two ends, the wall must be at least 0.5 mm and under half the diameter, merged ids must be tubes, and merged tubes must overlap into one solid. A run end that sits inside another tube's bore opens into it. Not yet in 3.0: changing diameter along the path (loft), flanges and a turbine volute (phase 2b). Examples: [tube-elbow](../services/geometry/src/geometry/spec/examples/v3/tube-elbow.json), [merge-three-runners](../services/geometry/src/geometry/spec/examples/v3/merge-three-runners.json). Golden summaries are in `services/geometry/tests/golden/`.

## Version 3.1: reducers and flanges

`part-spec.v3_1.schema.json` is 3.0 plus two features (turbo manifold support, phase 2b); every 3.0 spec stays buildable and is valid as 3.1 once its version is bumped (tested). Examples are in `examples/v3_1/`. The agent still writes 2.1.

| Type | What it makes | Key fields |
| --- | --- | --- |
| `reducer` | A straight pipe whose outer diameter changes linearly between two points (a cone). Hollow with open ends when `wall_thickness_mm` is set. Joins a `merge` like a tube. | `start_mm`, `end_mm`, `start_diameter_mm`, `end_diameter_mm`, `wall_thickness_mm`, `placement` |
| `flange` | A bolted end plate on one end (`start` or `end`) of a hollow tube or reducer, named by `tube`. The face is flush with the open end and the plate runs back along the pipe by `thickness_mm`; the bore stays open. `outline` is a `circle` or `rectangle`. `bolt_holes` has `hole_diameter_mm` and a `pattern`: `circular` (`count`, `circle_diameter_mm`, `start_angle_deg`) or `points` (`points_mm`). | `tube`, `end`, `outline`, `thickness_mm`, `bolt_holes` |

**Flange frame:** origin on the pipe axis at the open end; X and Y lie in the face seen from outside. X is the world Z axis crossed with the outward direction (world X when the pipe points along Z), so bolt positions do not depend on the machine. Each end takes one flange. Checks: the pipe must be hollow, the flange wider than the pipe, and every bolt hole clear of the pipe wall and inside the outline. A flange belongs to its pipe, so inside a `merge` its bolt holes are cut after fusing. A taper along a bent path is not supported yet; use a reducer between tubes. Examples: [flanged-reducer](../services/geometry/src/geometry/spec/examples/v3_1/flanged-reducer.json), [manifold-flange-runners](../services/geometry/src/geometry/spec/examples/v3_1/manifold-flange-runners.json).

## Version 3.2: turbine volute

`part-spec.v3_2.schema.json` is 3.1 plus the `volute` feature (turbo manifold support, phase 2c); every 3.1 spec stays buildable and is valid as 3.2 once its version is bumped (tested). A flange's `end` also accepts `inlet` and `outlet` (volute only). The agent still writes 2.1.

A `volute` is a turbine-style scroll housing sized from the vendor's numbers: `inducer_diameter_mm` (turbine wheel), `exducer_diameter_mm`, `a_over_r_cm` (A/R as vendors quote it: area in cm² over centroid radius in cm), `wall_thickness_mm`, plus optional `tongue_clearance_mm` (default 2), `inlet_length_mm` (default 30) and `outlet_length_mm` (default 60).

- **Frame:** origin on the wheel axis at the wheel plane, Z along the axis, the exhaust outlet towards -Z. The tongue is on the +X axis; the scroll winds counter-clockwise seen from +Z.
- **Sizing:** the passage has a round section whose area grows linearly with the angle, so its radius grows as the square root of the angle. Its inner edge touches the wheel cavity (inducer radius plus clearance). The largest section is solved so that area over centroid radius equals the A/R asked for.
- **Inlet:** a straight stub the size of the largest section, centered at x = cavity radius + largest section radius, flowing +Y and entering from -Y. Its outer diameter is `2 * (largest radius + wall)`. A hollow tube with that outer diameter, ending inside the stub, merges into it (tested).
- **Outlet:** a cone from the scroll down to the exducer bore at z = -`outlet_length_mm`.
- **Simplified:** no wastegate, bearing flange, nozzle vanes or twin-scroll divider. It is a fit and flow-path model for a one-piece manifold, to be reviewed with the turbo vendor's drawing before anything is made.
- Flanges attach to the `inlet` and `outlet` ends like on a pipe. Examples: [gt2871-style-volute](../services/geometry/src/geometry/spec/examples/v3_2/gt2871-style-volute.json), [volute-inlet-flange](../services/geometry/src/geometry/spec/examples/v3_2/volute-inlet-flange.json).

## Version 4.0: the CAD feature tree

`part-spec.v4.schema.json` is 3.2 plus five features that work like a CAD program's history (the start of "any shape a CAD program can make"). Every earlier spec stays buildable and is valid as 4.0 once its version is bumped (tested). The agent still writes 2.1. Examples are in `examples/v4/`.

CAD features run **in the order listed**. A `sketch` draws; `extrude` and `revolve` make solids; `boolean` and `transform` combine and move them. A solid that no later feature uses up is part of the result.

| Type | What it does | Key fields |
| --- | --- | --- |
| `sketch` | 2D shapes on a plane. `plane.name` is `XY` (x right, y up, normal +Z), `XZ` (x = world X, y = world Z, normal **-Y**) or `YZ` (x = world Y, y = world Z, normal +X), moved `offset_mm` along its normal and/or to `origin_mm`. Each shape has an `outer` outline and optional `holes`. | `plane`, `shapes` |
| outline kinds | `circle`, `rectangle`, `ellipse` (centered on `center_mm`, default [0, 0]); `polygon` (`points_mm`); `path` from `start_mm` through `line`, three-point `arc` (`mid_mm`, `to_mm`) and `spline` (`through_mm`) segments, closed back to the start with a straight line. | |
| `extrude` | Pushes a sketch into a solid by `distance_mm`. `direction` `normal`, `reverse` or `symmetric`; `taper_deg` (not with holes). `operation` `new` (default), `add`, `cut` or `intersect` combines it with the solid named by `target`. | `sketch`, `distance_mm`, `operation`, `target` |
| `revolve` | Spins a sketch about an `axis` (a line in sketch coordinates, default the sketch's y axis) by `angle_deg` (default 360). Same `operation` and `target`. | `sketch`, `axis`, `angle_deg` |
| `boolean` | `union`, `cut` or `intersect` of `target` with `tools`. All inputs are used up; the result takes the feature's id. | `operation`, `target`, `tools` |
| `transform` | `mirror` (across `XY`, `XZ` or `YZ`, moved `offset_mm`), then `rotate` (axis point, direction, angle), then `translate_mm`. `copy` keeps the source as well, to repeat a shape. | `source`, `mirror`, `rotate`, `translate_mm`, `copy` |

Checks, each with a plain sentence: sketch and target ids must come from earlier features, a solid can be used up only once, polygons need area, arcs need three points not in a line, ellipses need minor <= major, a taper cannot be combined with holes, and a cut that removes everything is reported. The CAD kernel's own failure text is replaced by "check the sketch outline and the numbers used" when it would not be readable.

**Not yet** (next steps): edge fillet and chamfer by selection, shell and draft, patterns, sweep and loft along sketches, and calling the older features (bodies, tubes, volute) from a `boolean`. Until then, the older features stay separate solids in the result.

## Version 4.1: sweep, loft and edge finishing

`part-spec.v4_1.schema.json` is 4.0 plus five features. Everything from 4.0 still works and every 4.0 example is valid as 4.1.

| Type | What it does | Key fields |
| --- | --- | --- |
| `curve` | An open path on a plane (same planes as `sketch`): `start_mm`, then `line`, three-point `arc` and `spline` segments. Used by `sweep`. | `plane`, `start_mm`, `segments` |
| `sweep` | Drags the first outline of sketch `profile` along `curve` `path`. The profile plane must pass through the curve start (within 0.5 mm) and should face along it. `operation`/`target` as for extrude. | `profile`, `path` |
| `loft` | Blends a solid through two or more `sketches` in order (one outline each, no holes). `ruled` gives straight faces. `operation`/`target` as for extrude. | `sketches`, `ruled` |
| `fillet_edges` | Rounds chosen edges of a solid (`solid` is used up; result takes this id). | `solid`, `edges`, `radius_mm` |
| `chamfer_edges` | Bevels chosen edges. Same selection. | `solid`, `edges`, `distance_mm` |

**Edge choice** (`edges`): `"all"`, or a list whose results are combined: `{"parallel": "X"|"Y"|"Z"}` (straight edges along that axis), `{"on_face": "top"|"bottom"|"left"|"right"|"front"|"back"}` (edges of the outermost face on that side; top +Z, right +X, back +Y), `{"near_mm": [x,y,z], "within_mm": r}` (edges whose middle is within r of the point). A choice that matches nothing is an error, and a size too large for the edges gives a plain message.

Examples: [cad-bent-pipe-sweep](../services/geometry/src/geometry/spec/examples/v4_1/cad-bent-pipe-sweep.json), [cad-bottle-loft](../services/geometry/src/geometry/spec/examples/v4_1/cad-bottle-loft.json), [cad-rounded-block](../services/geometry/src/geometry/spec/examples/v4_1/cad-rounded-block.json).

## Version 4.2: hollow, patterns and mirror

`part-spec.v4_2.schema.json` is 4.1 plus four features. 4.0 and 4.1 specs are valid as 4.2.

| Type | What it does | Key fields |
| --- | --- | --- |
| `hollow` | Thin-walled shell of `solid`, wall growing inward. `open_sides` (`top`, `bottom`, `left`, `right`, `front`, `back`) removes those sides, making a cup or tray; none gives a closed hollow. | `solid`, `thickness_mm`, `open_sides` |
| `linear_pattern` | `count` copies of `source`, each `spacing_mm` [x,y,z] further, joined into one solid. | `source`, `count`, `spacing_mm` |
| `circular_pattern` | `count` copies around an axis (`axis_point_mm`, `axis_dir`) over `angle_deg` (default 360, even spacing; less than 360 puts first and last that far apart). | `source`, `count`, `axis_point_mm`, `axis_dir`, `angle_deg` |
| `mirror` | Adds a mirrored copy of `source` across `plane` (+ `offset_mm`), joined to the original. For two separate solids use `transform` with `mirror` and `copy`. | `source`, `plane`, `offset_mm` |

To repeat holes or slots, pattern the cutter solid and then `boolean` cut it from the part (see [cad-bolt-circle-flange](../services/geometry/src/geometry/spec/examples/v4_2/cad-bolt-circle-flange.json)). Other examples: [cad-hollow-tray](../services/geometry/src/geometry/spec/examples/v4_2/cad-hollow-tray.json), [cad-mirrored-bracket](../services/geometry/src/geometry/spec/examples/v4_2/cad-mirrored-bracket.json).

## Version 4.3: draft, and CAD features that use older solids

`part-spec.v4_3.schema.json` is 4.2 plus `draft`. Specs from 3.2 to 4.2 are valid as 4.3.

| Type | What it does | Key fields |
| --- | --- | --- |
| `draft` | Leans faces of `solid` by `angle_deg` (0.1 to 30) so a moulded or cast part can be pulled out. Faces stay put on a neutral plane at the bottom of the part along `pull_direction` (`X`, `Y` or `Z`, default `Z`), or at the top with `neutral: "top"`, and lean inward as they get further from it. `faces` is `"sides"` (every face except flat ones facing along the pull direction, so cylinders and cones count) or a list of sides (`top`, `bottom`, `left`, `right`, `front`, `back`). | `solid`, `angle_deg`, `faces`, `pull_direction`, `neutral` |

**Older solids in the CAD tree.** Every CAD feature that takes a solid (`boolean`, `transform`, `fillet_edges`, `chamfer_edges`, `hollow`, `draft`, patterns, `mirror`, and `target` on extrude, revolve, sweep and loft) can name a `plate`, `body`, `tube`, `reducer`, `volute` or `merge` by id. These are built first, wherever they are listed, with their own holes, flanges and bolt holes. A plate bent onto another plate (`bend` `to_plate`) and a tube listed in a `merge` are part of something else and cannot be named; name the `bend`'s `from_plate` or the `merge` instead. A solid a CAD feature uses up is no longer part of the result; ones nothing uses stay, as before. Example: [cad-box-with-boss-and-hole](../services/geometry/src/geometry/spec/examples/v4_3/cad-box-with-boss-and-hole.json) adds a boss to and drills through an older box. Drafted example: [cad-drafted-housing](../services/geometry/src/geometry/spec/examples/v4_3/cad-drafted-housing.json).
