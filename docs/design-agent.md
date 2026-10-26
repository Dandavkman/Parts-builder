# Design agent

The design agent turns a chat request into a Part Spec. Code lives in `apps/web/src/lib/agent/`; the route is `POST /api/agent`.

## Request and stream

Send `{"message": "...", "design_id": "<uuid, optional>", "image": {"media_type": "image/jpeg", "data": "<base64>"}}` (message up to 4,000 characters; `image` is optional, JPEG, PNG or WebP, up to 900,000 base64 characters, which is about 650 KB; the browser shrinks photos to about 300 KB first). Without `design_id` a new design starts; with it, the saved conversation continues (only the owner can; anyone else gets 404). Sign-in is required. The first event tells you the design id. The reply is NDJSON, one event per line:

| Event | Meaning |
| --- | --- |
| `design` | `design_id` of the design this message belongs to. |
| `text` | A piece of the reply text. |
| `tool` | The agent used `list_anchors` or `measure`. |
| `spec` | A `propose_spec` attempt: `attempt` (1 to 6), `ok`, `errors`, and the `spec`. |
| `dimension` | The agent recorded a dimension with `add_dimension`: `dimension` has `id`, `value_mm`, `source`, `confidence`, `note`. |
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

## References and dimensions

A design's anchors and named dimensions live in `design_references` (one row per photo, lookup, scan or set of typed numbers). `POST /api/agent` gives the agent the anchors and dimensions of the design's **confirmed** references, and lists dimensions in the system prompt with their source and confidence. A design with no confirmed reference still gets the fixture panel (the stand-in for a scan); the first confirmed reference replaces it. `list_anchors` returns the anchors, and when there are dimensions, `{ anchors, dimensions }`. Dimensions are never sent to the geometry service.

## Photos and recorded dimensions

A photo sent with a message is saved as a `design_references` row (kind `photo`, base64 in the row, until file storage exists; decision D4). A design keeps at most 4. Each request puts the design's photos at the top of the first user message for that request only; they are not stored in the saved conversation, so history stays small. A photo gives shape and proportion, not size: the prompt tells the agent to take sizes only from a stated dimension or an object of known size in the same plane (it lists card, coin and paper sizes), and to ask when it cannot. The agent records each size it relies on with `add_dimension` (`id`, `value_mm`, `confidence` stated or estimated, `note` saying how it knows). Recorded dimensions are kept in one reference per design, replace an earlier one with the same id, appear in `list_anchors` and the prompt on later turns, and are shown to the user in the chat as "Noted ...". The first photo replaces the stand-in fixture panel, so a photo-based design has no anchors except `origin`.

## Photo button in the workspace

The `/design` page has a Photo button (on a phone it opens the camera). The browser shrinks the picture to at most 1,600 px on the long side as a JPEG under 700,000 base64 characters (`lib/photo.ts`; it lowers the size until it fits), shows a thumbnail with a reminder to give one real measurement or put a card or coin next to the object, and sends it with the next message. The right-hand panel lists the design's known sizes with a note on where each came from, and estimates are marked "please check". `GET /api/designs/<id>` now also returns `dimensions` and `photoCount`.

## Looking up measurements

When the user names a real product and gives no sizes, the agent can search the web (the Claude API's server-side `web_search` tool, about 1 cent per search plus tokens; `docs/accounts-and-keys.md` covers the spend limit). A design may use 5 searches in total (`WEB_SEARCHES_PER_DESIGN`, counted from the saved conversation); `DESIGN_AGENT_WEB_SEARCH=off` turns it off, and if the API says the tool is not available the agent drops it and carries on. The agent records what it finds with `add_dimension` (confidence `published`, an https `source_url`, a note). A found value is saved as an unconfirmed `researched` reference, so `loadReferences` hides it from the agent. The workspace shows it in a "Found online" box with the number, a source link, an editable value, Confirm and "Not right". `POST /api/designs/<id>/dimensions` with `{ "id", "action": "confirm" | "reject", "value_mm"? }` records the answer (owner only). A confirmed value reaches the agent from its next turn; a corrected number is stored as the user's own (`stated`) and keeps the source link. `GET /api/designs/<id>` returns `pendingDimensions`.
