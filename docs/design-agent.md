# Design agent

The design agent turns a chat request into a Part Spec. Code lives in `apps/web/src/lib/agent/`; the route is `POST /api/agent`.

## Request and stream

Send `{"message": "...", "design_id": "<uuid, optional>"}` (up to 4,000 characters). Without `design_id` a new design starts; with it, the saved conversation continues (only the owner can; anyone else gets 404). Sign-in is required. The first event tells you the design id. The reply is NDJSON, one event per line:

| Event | Meaning |
| --- | --- |
| `design` | `design_id` of the design this message belongs to. |
| `text` | A piece of the reply text. |
| `tool` | The agent used `list_anchors` or `measure`. |
| `spec` | A `propose_spec` attempt: `attempt` (1 to 6), `ok`, `errors`, and the `spec`. |
| `question` | The agent asked the user something and stopped. |
| `usage` | Running token totals for this message (input, output, cache). |
| `done` | `outcome` is `answered`, `asked`, `attempts_exhausted`, `refused` or `step_limit`. |
| `error` | Something failed; the text is safe to show. |

## What is saved

Every model message goes in `chat_messages` with token counts, and every `propose_spec` attempt in `design_versions` (failed ones too, with their errors). `designs.current_version` is the latest version that built. See `docs/decisions.md` for the table design. Needs `DATABASE_URL`; without it the route answers 503.

## Downloading a version

`GET /api/designs` lists the owner's designs (newest first, up to 50). `GET /api/designs/<id>` returns one design with all its versions (including ones that failed to build, with their errors) and its saved conversation as chat items, so the page can reopen it. `POST /api/designs/<id>/current` with `{ "version": n }` makes an earlier version that built the current one (undo); it never deletes anything, so a later version can be made current again, and a version that did not build gives 409. All three are owner-only.

`POST /api/designs/<id>/edit` with `{ "base_version": n, "spec": {...} }` is the slider route. The new spec must equal the base version's spec except for numbers (any other change gives 400), so sliders cannot add features or change text. It is rebuilt on the geometry service without calling the AI and saved as a new version with `created_by` `slider` only if it builds; a failed edit returns `{ ok: false, errors }` and saves nothing, so dragging through invalid values leaves no failed versions behind. The page shows a slider and a number box for every number under a key ending in `_mm` or `_deg` (up to 60), and sends a change after a 600 ms pause.

`GET /api/designs/<design id>/versions/<number or current>/download?format=step|stl|glb` (default step) builds the saved spec and returns the file with a download name. Only the owner can use it. A version that did not build gives 409 with its errors. Each version keeps the anchors it was built against.

## The page

`/design` (sign-in required) is the first workspace: chat, the part viewer and download links. It sends `{message, design_id}` to `/api/agent`, reads the stream and reloads the part when a spec builds. Until scans are connected it designs on a stand-in panel (`fixture-anchors.ts`).

## Tools

- `list_anchors`: the anchors the user picked (fixtures until B1.5).
- `measure`: distance in mm between two anchors.
- `propose_spec`: sends a full Part Spec to the geometry service. Success, or a plain sentence per problem.
- `ask_user`: one clarifying question; ends the turn.

## Keeping the prompt honest

The system prompt quotes `part-spec.v1.schema.json` and every file in `examples/v1/` verbatim, so the agent copies real field names instead of guessing. `pnpm generate` copies them into `apps/web/src/lib/agent/generated/`; CI fails if that copy is stale, and a test checks the prompt contains the schema and an example for every feature type. When the schema or an example changes, run `pnpm generate` and commit the result.

## Trying it

Set `ANTHROPIC_API_KEY`, `DATABASE_URL` and `GEOMETRY_SERVICE_URL` (and `GEOMETRY_SERVICE_TOKEN`, or run the geometry service with `GEOMETRY_AUTH_DISABLED=1`) in `apps/web/.env.local`, sign in, and POST to `/api/agent`. Running it costs API tokens.

## Safety rule sets

The prompt carries two named rule sets, `VEHICLE_SAFETY_RULES` (unchanged) and `EVERYDAY_SAFETY_RULES` (added 2026-10-26, decision D1), in `lib/agent/prompt.ts`. The real classifier is still B2.4; these are prompt text only.
