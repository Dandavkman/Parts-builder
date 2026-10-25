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

`GET /api/designs/<design id>/versions/<number or current>/download?format=step|stl|glb` (default step) builds the saved spec and returns the file with a download name. Only the owner can use it. A version that did not build gives 409 with its errors. Each version keeps the anchors it was built against.

## The page

`/design` (sign-in required) is the first workspace: chat, the part viewer and download links. It sends `{message, design_id}` to `/api/agent`, reads the stream and reloads the part when a spec builds. Until scans are connected it designs on a stand-in panel (`fixture-anchors.ts`).

## Tools

- `list_anchors`: the anchors the user picked (fixtures until B1.5).
- `measure`: distance in mm between two anchors.
- `propose_spec`: sends a full Part Spec to the geometry service. Success, or a plain sentence per problem.
- `ask_user`: one clarifying question; ends the turn.

## Keeping the prompt honest

`prompt.ts` holds a short Part Spec reference. A test fails if a feature type in `part-spec.v1.schema.json` is missing from it. When the schema changes, update the reference and `docs/part-spec.md` together.

## Trying it

Set `ANTHROPIC_API_KEY`, `DATABASE_URL` and `GEOMETRY_SERVICE_URL` (and `GEOMETRY_SERVICE_TOKEN`, or run the geometry service with `GEOMETRY_AUTH_DISABLED=1`) in `apps/web/.env.local`, sign in, and POST to `/api/agent`. Running it costs API tokens.
