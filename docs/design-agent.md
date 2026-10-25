# Design agent

The design agent turns a chat request into a Part Spec. Code lives in `apps/web/src/lib/agent/`; the route is `POST /api/agent`.

## Request and stream

Send `{"messages": [{"role": "user", "content": "..."}, ...]}`: plain text turns that alternate and end with the user (20 messages, 4,000 characters each). Sign-in is required. The reply is NDJSON, one event per line:

| Event | Meaning |
| --- | --- |
| `text` | A piece of the reply text. |
| `tool` | The agent used `list_anchors` or `measure`. |
| `spec` | A `propose_spec` attempt: `attempt` (1 to 6), `ok`, `errors`, and the `spec`. |
| `question` | The agent asked the user something and stopped. |
| `usage` | Running token totals for this message (input, output, cache). |
| `done` | `outcome` is `answered`, `asked`, `attempts_exhausted`, `refused` or `step_limit`. |
| `error` | Something failed; the text is safe to show. |

## Tools

- `list_anchors`: the anchors the user picked (fixtures until B1.5).
- `measure`: distance in mm between two anchors.
- `propose_spec`: sends a full Part Spec to the geometry service. Success, or a plain sentence per problem.
- `ask_user`: one clarifying question; ends the turn.

## Keeping the prompt honest

`prompt.ts` holds a short Part Spec reference. A test fails if a feature type in `part-spec.v1.schema.json` is missing from it. When the schema changes, update the reference and `docs/part-spec.md` together.

## Trying it

Set `ANTHROPIC_API_KEY` and `GEOMETRY_SERVICE_URL` (and `GEOMETRY_SERVICE_TOKEN`, or run the geometry service with `GEOMETRY_AUTH_DISABLED=1`) in `apps/web/.env.local`, sign in, and POST to `/api/agent`. Running it costs API tokens.
