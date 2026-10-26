# Estimate: how much code changes for a general market

Written 2026-10-26 against `main` after PR #27. Sizes are changed or new lines including tests and are rough (plus or minus 30%). Existing code today: about 3,400 lines of source (web 1,990, geometry 1,415) and about 1,900 lines of tests. This supports the proposal in `docs/plan.md` ("Revision: a general market").

## Short answer

Almost nothing that exists has to be thrown away. About 150 to 250 existing lines change (under 5% of the source), mostly wording and one type. The work is new code: roughly 3,000 to 3,500 lines in about 8 to 10 pull requests, and more than a third of it is Part Spec 2.0 (new shapes), which would be needed even for cars once a user asks for a round or hollow part.

## Stays as it is

| Module | Why it stays |
| --- | --- |
| Geometry service API, auth, Fly deploy (`api.py`, `export.py`, Dockerfile, `fly.toml`) | Takes any Part Spec and returns STEP, STL or GLB. Nothing car-specific |
| Spec builder core and the existing features (plate, hole, pattern, slot, fillet, chamfer, counterbore, countersink, standoff, rib, bend, cutout, text) | General flat-part features; still useful for boxes, lids, brackets and labels |
| Part Spec versioning (0.1, 1.0, 1.1 stay buildable) | A new 2.0 schema file is added beside them, as 1.1 was |
| Placement against anchors (`placement.py`) | An anchor is a point and a normal; a dimension or a photo-derived point works the same way |
| Database: designs, versions, chat, undo, history | Additive changes only |
| Agent loop, streaming, transcript, store, chat state | The loop already speaks tools and text; images are one more content block |
| Sliders, edit route, download routes, workspace layout | They work on any spec numbers |
| Sign-in, deploy docs, CI | Unrelated |
| Fit check (`fitcheck.py`) | Unchanged. It runs only when a scan exists, which is its current behavior |

## Changes slightly (about 150 to 250 lines)

| File | Change | Size |
| --- | --- | --- |
| `lib/agent/prompt.ts` | "custom car parts" wording; safety rules split into named sets (vehicle, everyday); material limits mention FDM | 60 |
| `app/layout.tsx`, `app/page.tsx` | Product description and copy | 10 |
| `lib/agent/types.ts`, `tools.ts`, `fixture-anchors.ts` | `dimension` anchor type; `list_anchors` becomes `list_references`; descriptions no longer say "on the scan" | 50 |
| `lib/agent/loop.ts` and tests | Pass an image block with the first message; allow new tools | 40 |
| Tests that quote the old prompt or tool names | Update | 40 |

## New work

| Task | What | Size | Notes |
| --- | --- | --- | --- |
| B1.13 | Generalize wording, rule sets | 150 | The changes in the table above |
| B1.14 | References table, dimension anchors | 300 | Additive migration; old designs unchanged |
| B1.15 | Photo input and scale | 500 | Two pull requests; storage decision D4 |
| B1.16 | Researched measurements | 350 | Web search cost, decision D5 |
| B1.17 | Part Spec 2.0 (extrude, revolve, shell, patterns, texture) | 1,200 to 1,500 | At least three pull requests; the biggest piece and the main technical risk (shells and textures on curved solids in CadQuery need care) |
| B1.18 | Dimension check and early wall check | 300 | |
| B1.19 | Starting point screen | 250 | |
| B1.20 | Everyday benchmark set | 200 | |
| Later | Multi-partner quotes (B2.5, B2.8), safety categories (B2.4), material recommendation tool | not estimated | Depend on decisions D1 and D2; these are Phase 2 tasks that were already planned, now a little larger |

## What is not affected

The scan tasks (B1.1 to B1.5) are unchanged in scope. They are still blocked on R2 keys and a real scan, and the other starting points no longer wait for them. B1.1 to B1.5 stay in the plan as the "scan" starting point.

## Risks to the estimate

- Part Spec 2.0 may need a hollow or curved-surface approach the CAD kernel makes hard (thin-wall shells with ridges). The first pull request should be a spike that builds the vase from the storyboard before the full feature set is committed.
- A photo gives proportions, not exact sizes. The plan requires a stated dimension or reference object for that reason; without one the agent has to ask.
- The Fly geometry service must be redeployed after any change under `services/geometry` (see `docs/deploy-fly.md`).
