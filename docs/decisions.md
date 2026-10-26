# Decisions

Newest first. One entry per decision: date, decision, why, and who made it.

## 2026-10-26: Photos ride along with the request and are re-attached each turn; the agent records sizes (B1.15a)

The photo is shrunk in the browser (B1.15b) and sent as base64 with the message, then kept in `design_references` (decision D4: Postgres until R2). Migration `0004_reference_photo` is additive. Each model request puts the design's photos at the top of the first user message; they are not written into the saved `chat_messages`, so conversations stay small and the photo is the same each turn (and sits in the cached prefix). Claude reads shape and proportion from a photo but not true size, so the prompt allows sizes only from a user-stated dimension or an object of known size in the same plane (a table of standard sizes is in the prompt), and tells the agent to ask when neither exists. A new tool, `add_dimension`, makes the agent write down each size it relies on, with how it knows (`stated` for user numbers, `estimated` for photo readings); estimates are labeled in the chat and the prompt asks the agent to get confirmation for the ones that matter before building. At most 4 photos per design and 900,000 base64 characters per photo.

## 2026-10-26: Part Spec 2.0 starts with `body`: extrude and hollow by cutting an inset copy (B1.17a)

The plate-only feature set cannot make a vase or a box. 2.0 adds one new feature, `body`, a solid with a height built from the same outlines as plates (rectangle with rounded corners, circle, polygon). Hollowing (`shell`) cuts a copy of the outline pulled in by the wall thickness instead of using the CAD kernel's shell, which tends to fail once edges are rounded; walls are exactly the stated thickness, and the vase from the storyboard (80 mm square, 200 mm tall, 2 mm walls) matches a hand calculation within 0.1%. The cavity is not rounded inside. A closed hollow (`open: none`) is allowed but a printer cannot drain it; the agent should prefer `top`. The plan's separate "patterns" item is folded into surface texture (B1.17c), because repeating holes already exist as `hole_pattern`. The agent keeps writing 1.1 until B1.17 is complete and Danny has redeployed the Fly service (`fly deploy`), since the live service would reject a 2.0 spec.

## 2026-10-26: References are a table; dimensions are separate from anchors (B1.14)

The plan said a new `dimension` anchor type. Instead a dimension is its own small record (`id`, `value_mm`, `source`, `confidence`, optional source link) stored beside the anchors in the new `design_references` table, because an anchor has a position and a normal that the geometry service needs for placement, and a dimension has neither; mixing them would mean filtering them out at every build. The tool is still called `list_anchors` (not `list_references`) because saved conversations contain tool calls by name and renaming it would break replay of old designs; it now returns dimensions too when there are any. Only confirmed references reach the agent, so a looked-up value the user has not accepted (B1.16) can never be built into a part. `designs.scan_id` is untouched. The migration is additive (`0003_design_references`).

## 2026-10-26: Safety rules become named sets; product copy says "parts" (B1.13)

The prompt's safety text is split into a vehicle set (the original wording, unchanged) and an everyday set with the categories the Owner approved in D1 (blocked: weapons, medical devices, child-restraint, life-safety and climbing gear; needs review: food and drink contact, mains enclosures, load-bearing for a person). The line "non-automotive parts are out of scope" is removed. The landing page and page description no longer say car. The classifier (B2.4) is not built yet.

## 2026-10-26: Sliders edit numbers only, and failed edits are not saved (B1.9b, part 2)

Every number under a `_mm` or `_deg` key gets a slider. A slider edit goes to `POST /api/designs/<id>/edit`, which checks the new spec has exactly the same shape and text as the version it was made from, so only numbers can change (this keeps the future safety classifier's view of a design valid, because sliders cannot add a feature or change a category). It rebuilds on the geometry service with no AI call and saves a new version (`created_by` = `slider`) only if the build works; a failed build is shown to the user and not saved, unlike agent attempts, because a drag passes through many values and would bury the history. Slider ranges are a guess from the current value (0 to double for sizes, symmetric for positions, -360 to 360 for angles); the number box accepts any value and the builder is the judge. The see-through scan toggle is still waiting for real scans.

## 2026-10-26: Earlier designs, version history and undo (B1.9b, part 1)

B1.9b is split so each pull request stays small. Part 1 adds a list of earlier designs, a version list and undo; part 2 adds sliders and the edit-and-rebuild route; the see-through scan toggle waits for real scans (B1.2). Undo does not delete or rewrite anything: it moves `designs.current_version` to an earlier version that built, so any version can be made current again, and the viewer and downloads always show the current version by its number. A version that failed to build cannot be current. Reopening a design rebuilds its chat from the saved messages (what the user typed, what the agent said and asked, the user's answers to questions); tool calls are not shown. If the agent then adds a new version, it becomes current as before.

## 2026-10-25: Part Spec 1.1 adds a circle outline (B1.6b)

The first live shift-knob run showed the agent had no way to say "round": v1 plates are a rectangle or a polygon, so it had to fake circles with many-sided polygons. Spec 1.1 adds `{"kind": "circle", "diameter_mm": n}`, centered on the plate origin, and nothing else (rule 6: version bumped, and 1.0 and 0.1 specs stay valid and buildable). It is a new schema file (`part-spec.v1_1.schema.json`) beside the 1.0 one, the same way 1.0 sits beside 0.1, so every released version keeps its own source of truth. The builder extrudes a true circle. Fit checks (holes inside the plate, edge distance) treat a circle as a 128-sided polygon, which is off by under 0.04% of the radius. Bends still need plain rectangle plates. `PartSpec` in `packages/part-spec` now means 1.1 and `PartSpecV1` is 1.0. The design agent now writes `spec_version` "1.1" and is told to use `circle` for anything round. Shapes such as ellipses and rounded polygons are not added until a real design needs them.

## 2026-10-25: The agent's prompt quotes the real schema and every example (B1.8c)

The first live try (an NA Miata shift knob) used all 6 build attempts on guessed field names: the prompt only had a prose summary of the spec, so the agent invented `height_mm` and left out the outline `kind`. The system prompt now contains the v1 JSON Schema and every example spec verbatim, plus the rule to copy the shape from them when a schema error comes back. They are copied into `apps/web/src/lib/agent/generated/` by `pnpm generate` (the web app cannot read files outside `apps/web` at run time), and CI fails if the copy is stale. The prompt is about 5,000 tokens, so it is cached across turns. Cost: roughly 1 cent more on the first message of a conversation, less on later ones.

## 2026-10-25: Workspace starts as one page, `/design`, split into B1.9a and B1.9b

B1.9a is chat on the left and the part on the right, with STEP and STL download links for the latest version that built. Chat state lives in a small pure reducer (`lib/agent/chat-state.ts`) over the agent's event stream, so it is unit tested without a browser. The viewer is the existing three.js viewer, now taking any GLB URL; the page reloads it from `/api/designs/<id>/versions/current/download?format=glb` after each spec that builds. The page works on the fixture panel until anchors come from real scans. B1.9b (left for later): see-through toggle with the scan, auto-generated sliders for every number in the spec, version history with undo, and listing earlier designs. Sliders must make a new version without calling the AI (`created_by` = `slider`), so they need a small edit-and-rebuild route first.

## 2026-10-25: Downloads rebuild a saved version on demand, with the anchors it was built against (B1.11b)

`GET /api/designs/<id>/versions/<n|current>/download?format=step|stl|glb` reads the saved Part Spec and asks the geometry service to build it; nothing is stored in R2 (same choice as B1.11a: builds are fast and deterministic, so the same version always gives the same file). Only the owner can download, a version that never built gives 409 with its errors, and a spec that no longer builds gives 422. Because a spec refers to anchors by name, each version now keeps a copy of the anchors it was built against (migration `0002_version_anchors`, additive); otherwise editing an anchor later would silently change an old version. If file storage turns out useful (sharing links, order files in Phase 2), that is a later change.

## 2026-10-25: Database layer: Drizzle on Neon, migrations as bundled SQL, one row per model message

B1.8b adds `designs`, `design_versions` and `chat_messages` (new tables only, nothing existing is touched). Drizzle gives the typed queries, over Neon's HTTP driver, which suits Vercel functions. Migrations are numbered, idempotent SQL strings in `src/lib/db/migrations.ts`, applied on first use per server instance and recorded in `_migrations`. We chose this over drizzle-kit migration files because the SQL ships inside the server bundle (no file paths to trace on Vercel), needs no deploy step and reads `DATABASE_URL` only at request time, per the no-secrets-at-build rule. Never edit an applied migration; add a new one. Tests run the same SQL on PGlite (in-process Postgres), so CI needs no database.

- Every `propose_spec` attempt is a version, including ones that failed to build, with its errors. `designs.current_version` points at the latest that built. Slider and user edits (B1.9) will use `created_by` `slider` or `user`.
- Messages keep the exact content blocks (tool calls, results, thinking) so a conversation replays correctly, with token counts on assistant messages. Cost reporting (B2.11) sums these.
- A question from `ask_user` leaves a tool call open; the next user message answers it as the tool result.
- Owner is the Clerk user id, so a user can only read or continue their own designs (404 otherwise). A users table comes with plans in Phase 2.
- Two requests at the same instant on one design could race on message numbers; the unique constraint makes the loser fail rather than corrupt. One chat per design at a time is the expected use.

## 2026-10-25: Design agent (B1.8) split into B1.8a loop and B1.8b saving; Sonnet 5.5, fixture anchors

B1.8a is the tool-use loop and a streaming route, `POST /api/agent`. B1.8b adds the database and saves every spec version and message with token counts, and needs Postgres (Neon free tier, Owner approved). The loop runs on the web server, calls Claude through the official SDK and never runs AI-written code: `propose_spec` sends the JSON to the geometry service's `/build`, which either builds it or returns plain-sentence errors. Defaults and limits:

- Model `claude-sonnet-5-5`, changeable with `DESIGN_AGENT_MODEL`. Server-side refusal fallback is on (`fallbacks: "default"`).
- At most 6 `propose_spec` attempts per user message. After the sixth failed one the agent gets one more turn with tools off, to show its best result and the remaining issues. Total model calls per message are capped at 14.
- `ask_user` ends the turn. Chat history is plain text for now; B1.8b will store tool calls so a question can be answered in context.
- Anchors are fixtures (`fixture-anchors.ts`) until anchor fitting (B1.5). `measure` only does anchor to anchor distances; clearance to the scan surface and the fit check inside `propose_spec` wait for scan upload.
- The safety rules are prompt text taken from the plan. The real classifier is B2.4 and was not touched.
- Events stream as one JSON object per line: text, tool, spec, question, usage, done, error.

## 2026-10-25: Shared bearer token between web app and geometry service

The Fly service is on the public internet, so `POST /build` requires `Authorization: Bearer <GEOMETRY_SERVICE_TOKEN>`, compared in constant time. `/health` stays open because Fly's health check cannot send headers. The service fails closed: no token configured gives 503, a wrong or missing one gives 401. `GEOMETRY_AUTH_DISABLED=1` skips the check for local development and tests and must never be set on Fly. The token is read at request time, never at build time, and lives only in Fly secrets and Vercel server-side variables. Rotating it means setting the new value on both, then redeploying the web app. No cost, no architecture change.

## 2026-10-25: Fit check v1 (B1.10) measures against sampled scan surface, not exact triangles

Exact closest-point queries on a triangle mesh need a spatial index library (`rtree` or an embree wheel) that is not installed, and slow on million-triangle scans. Instead `ScanIndex` takes up to 1,000,000 seeded surface samples, finds plane normals by fitting neighbours, and uses a SciPy KD-tree. This adds `scipy` as a direct dependency (free, already pulled in by other libraries). Single-triangle normals are not trusted, because the noisy synthetic scan has sliver triangles; this was found by testing, where it gave depth errors of several millimeters. Trade-off: about 0.1 mm error on a noisy scan and up to the sample spacing near sharp edges, which the docs state. Part holes are paired with the nearest scan hole within 10 mm because the Part Spec has no field naming the intended anchor for a hole. Details in `docs/fit-check.md`.
## 2026-10-25: Downloads are built on demand by `/build`, split into B1.11a and B1.11b

"STL and STEP download for any version" needs saved part versions, which the plan only creates in B1.8, and there is no versions table yet. B1.11a makes the geometry service's `POST /build` take a Part Spec plus anchors and return STEP, STL or GLB (a request with no body still returns the demo plate, so the live viewer keeps working). B1.11b, after B1.8, adds the web route and button that look up a saved version and call it. Files are rebuilt each time rather than stored: the same spec always gives the same bytes (tested), so nothing needs saving, and the web app stays the only service that writes. Unbuildable specs return 422 with the builder's plain-language error list. Download filenames are made from the spec name reduced to `a-z`, `0-9` and `-`, so a name cannot inject header text. Known gap: the service has no sign-in, so once it is on the public internet anyone could ask it to build parts. Before real users, add a shared secret between Vercel and Fly (a follow-up task, flagged to the Owner).
## 2026-10-25: Geometry service on Fly.io: one 2 GB machine that stops when idle

B0.7 deploys `services/geometry` with a Dockerfile on `python:3.12-slim` and `fly.toml`. Choices: (1) `shared-cpu-2x` with 2 GB, because the demo build peaked near 0.55 GB and the fit check will use more; a bigger machine for scan processing (B1.2) is a later decision. (2) `auto_stop_machines = "stop"` with no always-on machine, so cost is for running seconds only (estimated under $1 a month while testing, about $11 to $12 if it ran 24/7; check Fly's pricing page). The cost is a slow first request after idle. (3) Region `iad` (Virginia), next to Vercel's default region, so calls between the two are short. (4) The owner creates the app with `fly apps create` and deploys with `fly deploy`, not `fly launch`, so `fly.toml` is not rewritten. (5) No dedicated IPv4 (it costs monthly); the free shared address is enough. (6) Deploy by hand for now; automatic deploys from GitHub need a Fly token stored as a GitHub secret and are left until the Owner asks. The image build could not be run in the Builder's environment (no Docker daemon), so the install and server start were tested in a clean folder and the system libraries were checked with `ldd`; the first real `fly deploy` is the full test.

## 2026-10-25: Spec builder (B1.7) is split in two and reads both spec versions

B1.7a ships the builder framework, validation, export and plate, hole, hole_pattern, slot, fillet and chamfer. B1.7b adds counterbore, countersink, standoff, rib, bend, cutout and emboss_text. This keeps each pull request under about 600 lines. The builder reads v0.1 and v1.0 specs directly (v0.1 is converted in memory), with no stored converter. Anchors are passed in as data (`Anchor(point_mm, normal)`) until scan anchors exist (B1.3/B1.4). Golden-file tests store a geometry summary (volume, bounding box, face and solid counts) per spec, not binary CAD files, so they survive CAD-kernel upgrades; regenerate with `UPDATE_GOLDEN=1`. STEP files carry an export time and a per-process counter, so `export_bytes` pins both to make output byte-identical. The `/build` API still serves the demo plate; wiring it to the builder comes with the work that needs it.

B1.7b adds the rest. Choices: (1) Bends join two plain rectangle plates of equal thickness and equal edge length, curve toward the top face, and do not chain, because those rules keep the geometry exact and checkable; loosen them when a benchmark part needs it. (2) Fillets and chamfers run before any additions or cuts so they only see outline edges (hole walls have vertical seam edges that would be picked up otherwise). (3) Standoffs, ribs and raised text start 0.5 mm inside the plate (or half its thickness if thinner) so the union never depends on coplanar faces. (4) Text uses the bundled DejaVu Sans Bold (`builder/fonts/`, Bitstream Vera license, free to redistribute) so output does not depend on fonts on the server; `height_mm` is cap height (font size divided by 0.729). (5) A cutout that removes no material is an error rather than a silent no-op.

## 2026-10-25: Launch car is the Mazda Miata NA (1990 to 1997); first car is a 1995 NA8

The Owner chose the first-generation Miata. The car available for scanning is a 1995 NA8 (the 1.8 L car, built 1994 to 1997). The NA6 (1.6 L, 1990 to 1993) shares the chassis but differs in places such as the engine and some trim. Fit claims are made only for cars that have actually been scanned and tested, so until other years are scanned, parts are described as tested on a 1995 NA8. Compatibility tags (B3.6) must record what was tested, not the whole generation. Benchmark parts (O0.7) should be chosen for this car.

## 2026-10-24: Deploy the web app to Vercel from the start; local setup is optional

The plan had the Owner run everything locally first and deploy later. That meant installing Node, pnpm, uv and Docker, and keys went in a local file that is easy to get wrong. Instead the web app deploys to Vercel now (root directory `apps/web`), and keys go in Vercel's Environment Variables screen. Vercel also gives every pull request a preview link, so the Owner reviews work in a browser. The geometry service still needs Fly.io (new task B0.7), so until then the viewer shows "Could not load the plate". Local running stays documented but optional. Hosting stays Vercel plus Fly.io (see the earlier decision against Render). Vercel's Hobby plan is non-commercial, so move to the paid plan before taking orders (Phase 2).

## 2026-10-25: Hosting the geometry service is postponed to Phase 1

The Owner does not want a card on file before there is revenue. Nothing needed before Phase 1 depends on a hosted geometry service: it only powers the viewer's demo plate, and that was checked with the real services. Free hosts were checked and rejected. Vercel's Python limit (500 MB) is below the service's installed size (about 1.8 GB, mostly the 3D engine). Hugging Face Spaces and Render's free tier are unconfirmed for this use: free compute Spaces may need a paid plan, and Render's free instance is small and sleeps. Tasks B0.7 and O0.10 move to Phase 1, before scan processing (B1.2). Gate G0 now checks that the plate renders in the viewer (verified with the real services), not that it shows on the live site.

When hosting is needed: Fly.io requires a card or prepaid credits. Prepaid cards reportedly cannot be the saved card but can buy credits (about $25 minimum), which also caps spending. Confirm current terms on Fly's billing page and set a billing alert.

## 2026-10-22: Part Spec v1 is a new schema file; v0.1 stays frozen

Part Spec v1 (`spec_version` "1.0") lives in `part-spec.v1.schema.json`. The v0.1 schema and its examples are untouched, so old specs still validate and stay buildable (rule 6). Each version gets its own generated TypeScript file, and `PartSpec` in `packages/part-spec` now means v1 (`PartSpecV0_1` is the old one). v1 changes the plate: `width_mm` and `length_mm` moved into an `outline` that is a rectangle or a polygon, so v0.1 specs are not valid v1 specs. Callers pick the schema from `spec_version`, and the builder (B1.7) will read both. Features other than plates use plate-local `position_mm`, and only plates and cutouts have an anchor `placement`. Cross-feature checks (ids exist, features fit on the plate) stay with the builder, as noted below. Documented in `docs/part-spec.md`.

## 2026-10-22: CadQuery gotcha: chained `.center()` accumulates

Calling `faces(">Z").workplane().center(x, y).hole(d)` repeatedly on the same result moves each new hole by the previous offsets, because the workplane remembers its last center. Found while building the synthetic scan (B0.5), where the mesh disagreed with the ground truth. Spec builders (B1.7) must place each feature from a fresh workplane (for example `cq.Workplane("XY").center(x, y)` and `cut`), or pass all points to one `pushPoints` call, and tests must check feature positions against the built geometry, not just the spec.

## 2026-10-22: Part Spec JSON Schema is the single source of truth

The schema lives at `services/geometry/src/geometry/spec/part-spec.schema.json`. Python validates against it with `jsonschema`, and the TypeScript types in `packages/part-spec` are generated from it with `pnpm generate`. CI fails if the generated file is out of date. JSON Schema cannot check that a `plate` id referenced by a hole exists, so the spec builder (B1.7) must do that check and give a clear error.

## 2026-10-22: TypeScript pinned to 6.x

`typescript-eslint` does not support TypeScript 7 yet, so the root `package.json` pins TypeScript to the 6 line. Move to 7 once `typescript-eslint` supports it.

## 2026-10-22: No local S3 emulator; development uses an R2 dev bucket

The plan called for MinIO as a local S3. MinIO's community edition is no longer distributed as Docker images and its repository is archived, so it is not a safe base. Local `docker compose` runs Postgres and Redis only. Development storage is a real bucket (`parts-builder-dev`) on Cloudflare R2, which has no download fees. Automated tests must not call R2: use an in-process fake or mock for storage. If offline development becomes important, revisit with an S3-compatible emulator and test its presigned URL and CORS behavior first.

## 2026-10-22: Host on Vercel and Fly.io, not Render

The web app runs on Vercel and the geometry workers on Fly.io, as in the plan. Render was considered because it would put everything on one platform, but its workers bill while idle. Fly.io workers can scale to zero, which keeps costs lowest before there are users. Vercel limits how long a server request can run, so the design agent's chat route (B1.8) must stream its response and set a higher maximum run time in its config. Heavy 3D work stays on the Fly.io workers. Decided by the Owner to start as lean as possible.

## 2026-10-22: The AI writes a Part Spec, not code or meshes

The design agent outputs a JSON Part Spec built from a fixed list of features, positioned against anchors picked on the scan. Our own tested Python (CadQuery) turns it into exact geometry. This keeps AI-written code off our servers, gives exact dimensions, makes every number a slider, and lets checks read the spec directly. The trade-off is that users can only make shapes the feature list supports. Decided in the master plan.

## 2026-10-22: Launch with non-structural parts only

Brakes, suspension, steering, wheels, seat and seatbelt mounts, airbag areas, fuel system and tow points are blocked in code. Underhood-near-heat and emissions-related parts need admin review before ordering. Decided in the master plan.
