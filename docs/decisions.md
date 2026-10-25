# Decisions

Newest first. One entry per decision: date, decision, why, and who made it.

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
