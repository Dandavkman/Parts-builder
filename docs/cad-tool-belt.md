# CAD tool belt

A set of small, fixed CAD operations that any agent or program can call to build a part step by step. It sits on the same Part Spec engine as everything else ([part-spec.md](part-spec.md)); each tool adds or removes one feature and checks the result. No code from the caller is ever run (rule 5): a call only edits plain data.

The geometry service is stateless (rule 10). The **caller keeps the spec** between calls: every result returns the updated spec, and a rejected call returns the spec unchanged along with plain-sentence errors. To undo, keep the previous spec.

Both faces need the same bearer token as `/build` (`GEOMETRY_SERVICE_TOKEN`; `GEOMETRY_AUTH_DISABLED=1` for local use). No new environment variables.

## Tools

`new_part`, then any of: `add_sketch`, `add_curve`, `extrude`, `revolve`, `sweep`, `loft`, `boolean`, `transform`, `fillet_edges`, `chamfer_edges`, `hollow`, `draft`, `linear_pattern`, `circular_pattern`, `mirror`, and `remove_feature`, `inspect_part`. The arguments of each add tool are the feature's fields in the schema ([part-spec.md](part-spec.md) lists them), plus `spec`. Descriptions and JSON Schemas are generated from `part-spec.v4_4.schema.json`, so they cannot drift from the engine. Specs of version 3.2 to 4.4 are accepted and upgraded to 4.4. Plates, bodies, tubes and merges already in a spec show up as free solids and can be named by the CAD tools.

Every successful result is `{ ok: true, spec, summary }`. The summary has the feature list, `free_solids` (solids nothing has used up yet, which become the part), `solid_count`, and when there is geometry, `volume_mm3` and `bbox_mm`. A failure is `{ ok: false, errors: [...], spec }`.

## HTTP

```
GET  /tools                 -> { tools: [{ name, description, inputSchema }] }
POST /tools/{name}          body: the tool's arguments (including "spec") -> result above
```

```
curl -s -H "Authorization: Bearer $TOKEN" -X POST $URL/tools/new_part -d '{"name":"cup"}' -H 'content-type: application/json'
```

## MCP

`POST /mcp` speaks MCP over HTTP (JSON-RPC, JSON responses, no sessions): `initialize`, `ping`, `tools/list`, `tools/call`. A `tools/call` result carries the same object as text and as `structuredContent`, with `isError` set when `ok` is false. Point any MCP client that supports HTTP servers at `<geometry service URL>/mcp` with the bearer token header. The endpoint does not stream, so `GET /mcp` is 405.

## Example flow

1. `new_part { name: "cup" }`
2. `add_sketch { spec, id: "sk", plane: { name: "XY" }, shapes: [{ outer: { kind: "circle", diameter_mm: 30 } }] }`
3. `extrude { spec, id: "body", sketch: "sk", distance_mm: 40 }`
4. `hollow { spec, id: "cup", solid: "body", thickness_mm: 2, open_sides: ["top"] }`

The final `spec` goes to `/build` for STEP, STL or GLB, or into a design.

## What it covers (Part Spec 4.0 to 4.4)

| Version | Adds |
| --- | --- |
| 4.0 | Sketches, extrude, revolve, boolean, transform |
| 4.1 | `curve`, sweep, loft, fillet and chamfer of chosen edges |
| 4.2 | `hollow`, linear and circular patterns, `mirror` |
| 4.3 | `draft` (lean faces for moulding), and every CAD feature can use plates, bodies, tubes, reducers, volutes and merges by id |
| 4.4 | `volute` gets `channels` (1, 2 or 4, each with its own inlet) and `inlet_diameter_mm`, for divided-scroll turbo housings |

Each version is its own schema file, so every older spec still builds. Details and examples are in [part-spec.md](part-spec.md); design choices are in [decisions.md](decisions.md) (entries dated 2026-11-05).

**Known limits.** Draft uses a neutral plane at the bottom or top of the part along X, Y or Z, with one angle for all chosen faces. Sweep and loft take one outline without holes (make hollow shapes with a second sweep or loft and a `boolean` cut). A plate bent onto another and a tube inside a `merge` cannot be named by CAD features; name the `from_plate` or the `merge`. The tool belt has been tested with automated tests only, not yet against the live model or a deployed service.

## Turning it on (Owner steps)

1. Run the standard `fly deploy` for the geometry service. Until then Fly has none of Part Spec 4.x or the `/tools` and `/mcp` endpoints.
2. In Vercel, set `DESIGN_AGENT_SPEC_VERSION=4.4` (`4.2` and `4.3` are accepted and mean the same). The design agent then writes Part Spec 4.4 and gets the step-by-step `cad_tool`. Leave it empty to stay on the current version; the web app itself needs no other change and no new variables.
3. Try prompts that need real CAD: a bottle lofted from a round base to a square middle to a round neck, a bent pipe made from two sweeps, a bolt-circle flange, a housing with draft on its sides.
4. To use the tools from another agent, point an MCP client at `<geometry service URL>/mcp` with the bearer token, or call `/tools` over HTTP as above.
