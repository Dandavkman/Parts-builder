# CAD tool belt

A set of small, fixed CAD operations that any agent or program can call to build a part step by step. It sits on the same Part Spec engine as everything else ([part-spec.md](part-spec.md)); each tool adds or removes one feature and checks the result. No code from the caller is ever run (rule 5): a call only edits plain data.

The geometry service is stateless (rule 10). The **caller keeps the spec** between calls: every result returns the updated spec, and a rejected call returns the spec unchanged along with plain-sentence errors. To undo, keep the previous spec.

Both faces need the same bearer token as `/build` (`GEOMETRY_SERVICE_TOKEN`; `GEOMETRY_AUTH_DISABLED=1` for local use). No new environment variables.

## Tools

`new_part`, then any of: `add_sketch`, `add_curve`, `extrude`, `revolve`, `sweep`, `loft`, `boolean`, `transform`, `fillet_edges`, `chamfer_edges`, `hollow`, `linear_pattern`, `circular_pattern`, `mirror`, and `remove_feature`, `inspect_part`. The arguments of each add tool are the feature's fields in the schema ([part-spec.md](part-spec.md) lists them), plus `spec`. Descriptions and JSON Schemas are generated from `part-spec.v4_2.schema.json`, so they cannot drift from the engine. Specs of version 3.2 to 4.2 are accepted and upgraded to 4.2.

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
