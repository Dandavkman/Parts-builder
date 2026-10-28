import { PART_SPEC_V1_EXAMPLES, PART_SPEC_V1_SCHEMA } from "./generated/part-spec-v1-reference";
import { PART_SPEC_V2_EXAMPLES, PART_SPEC_V2_SCHEMA } from "./generated/part-spec-v2-reference";
import { PART_SPEC_V2_1_EXAMPLES, PART_SPEC_V2_1_SCHEMA } from "./generated/part-spec-v2-1-reference";
import type { AgentAnchor, AgentDimension } from "./types";

/** How a spec is put together. The exact fields come from the schema and examples quoted below. */
export const SPEC_CONVENTIONS = `
Part Spec is JSON: {"spec_version": "1.1", "name": "...", "features": [...]}.
Lengths are millimeters (_mm), angles degrees (_deg). Every feature has a unique "id" (lowercase letters, digits, underscore) and a "type".
Only a plate has a "placement": {"anchor": "<anchor id or origin>", "offset_mm": [x, y, z], "rotation_deg": n}. Never write absolute positions.
Every other feature names its plate in "plate" and uses "position_mm": [x, y] in that plate's frame, origin at the plate center.
A rectangular plate is {"kind": "rectangle", "width_mm": ..., "length_mm": ...}; a round plate is {"kind": "circle", "diameter_mm": ...}, centered on the plate origin; a polygon plate is {"kind": "polygon", "points_mm": [[x, y], ...]}. Use "circle" for anything round, never a many-sided polygon.
Use only the fields in the schema. Never invent field names. The schema rejects extra fields.
The builder reports every problem in plain sentences, for example "hole 'hole_2' ... is outside plate 'base'". Schema errors name the field path, such as "features/0/outline: 'kind' is a required property". When you get one, find that field in the schema and the examples below and copy the shape exactly. Do not guess again.
`.trim();

/** Added to the conventions for Part Spec 2.0: solid bodies (task B1.17). */
export const SPEC_CONVENTIONS_V2 = `
Part Spec 2.0 adds the "body" feature for anything with volume: boxes, cups, vases, holders, knobs. Use a body for solid or hollow objects and a plate only for flat parts. Use "spec_version": "2.0".
A body has "shape" (the first Z-up solid sits on Z = 0, centered on its placement): {"kind": "extrude", "outline": <rectangle, circle or polygon outline>, "height_mm": ...} for straight sides, or {"kind": "revolve", "profile_mm": [[radius, z], ...]} for round shapes, listing the outside from base to rim with z strictly increasing.
Optional "shell": {"wall_thickness_mm": ..., "open": "top"} makes it hollow with an open top ("none" for a closed hollow). Optional "edge_fillet_mm" rounds the outer edges. Optional "texture": {"kind": "ridges" or "grooves", "width_mm", "depth_mm", "spacing_mm", "z_range_mm"} puts vertical stripes on the outside wall of rectangle and circle extrusions and revolved bodies.
Height is the Z size. When the user states an overall size, record it with add_dimension and "measures", then make the built part match it exactly: a revolved vase's widest radius is half its width.
`.trim();

/** Added to the conventions for Part Spec 2.1: blind bores and separate round-overs (task B1.22). */
export const SPEC_CONVENTIONS_V2_1 = `
Part Spec 2.1 lets a body carry "bores" and round its top and bottom edges separately. Use "spec_version": "2.1".
A bore is a blind hole drilled along Z: {"diameter_mm", "depth_mm", "from": "bottom" or "top", "position_mm": [x, y]} (position defaults to the center). Use bores for shift-knob sockets, peg sockets and pockets; never try to put a "hole" feature in a body, because holes only go in plates. A bore cannot be combined with "shell".
For a threaded hole, drill the tap-drill size and tell the user to tap it or press in a threaded insert: for example 8.8 mm for M10x1.25. Call fastener_lookup for the exact size (tap, clearance, insert or counterbore) instead of remembering it. Never use the thread's outer diameter as the hole.
Use "edge_fillet_top_mm" and "edge_fillet_bottom_mm" to round one edge, or "edge_fillet_mm" for both; do not mix them.
`.trim();

export function specReference(version: SpecVersion = "1.1"): string {
  if (version === "2.1") {
    return [
      SPEC_CONVENTIONS.replace('"spec_version": "1.1"', '"spec_version": "2.1"'),
      SPEC_CONVENTIONS_V2.replace('Use "spec_version": "2.0".', 'Use "spec_version": "2.1".'),
      SPEC_CONVENTIONS_V2_1,
      `JSON Schema for Part Spec 2.1 (authoritative):\n${JSON.stringify(PART_SPEC_V2_1_SCHEMA)}`,
      `Valid example specs, one or more per feature:\n${PART_SPEC_V2_1_EXAMPLES.map((e) => JSON.stringify(e)).join("\n")}`,
    ].join("\n\n");
  }
  if (version === "2.0") {
    return [
      SPEC_CONVENTIONS.replace('"spec_version": "1.1"', '"spec_version": "2.0"'),
      SPEC_CONVENTIONS_V2,
      `JSON Schema for Part Spec 2.0 (authoritative):\n${JSON.stringify(PART_SPEC_V2_SCHEMA)}`,
      `Valid example specs, one or more per feature:\n${PART_SPEC_V2_EXAMPLES.map((e) => JSON.stringify(e)).join("\n")}`,
    ].join("\n\n");
  }
  return [
    SPEC_CONVENTIONS,
    `JSON Schema for Part Spec 1.1 (authoritative):\n${JSON.stringify(PART_SPEC_V1_SCHEMA)}`,
    `Valid example specs, one or more per feature:\n${PART_SPEC_V1_EXAMPLES.map((e) => JSON.stringify(e)).join("\n")}`,
  ].join("\n\n");
}

export type SpecVersion = "1.1" | "2.0" | "2.1";

/**
 * Which Part Spec the agent writes. It stays 1.1 until DESIGN_AGENT_SPEC_VERSION is set to 2.0 or 2.1, which
 * must only happen after the Fly geometry service has been redeployed with that Part Spec.
 */
export function agentSpecVersion(env: Record<string, string | undefined> = process.env): SpecVersion {
  const v = env.DESIGN_AGENT_SPEC_VERSION;
  return v === "2.0" || v === "2.1" ? v : "1.1";
}

/** Rules for parts that go on a vehicle. Unchanged by the general-market revision. */
export const VEHICLE_SAFETY_RULES = `
Vehicle parts. Allowed: mounts and brackets, interior parts (gauge pods, switch panels, trim, cup holders), covers and trim (blanking plates, badges, grommets).
Needs review (design it, but tell the user it cannot be ordered until an admin approves): anything near the exhaust or turbo, and intake or exhaust parts that change engine airflow.
Blocked (refuse in plain words, do not call propose_spec): brakes, suspension, steering, wheels and hubs, seat and seatbelt mounts, airbag areas, fuel system, tow points.
`.trim();

/** Rules for everything else (decision D1, 2026-10-26). */
export const EVERYDAY_SAFETY_RULES = `
Everyday objects. Allowed: vases and planters that do not hold hot liquids, boxes, organizers, holders, knobs, clips, replacement caps, hobby and display pieces.
Needs review (design it, but tell the user it cannot be ordered until an admin approves): anything that touches food or drink for repeated use, enclosures for mains-powered electrical parts, and anything that carries a person's weight.
Blocked (refuse in plain words, do not call propose_spec): weapon and firearm parts, medical devices and implants, child-restraint and car-seat parts, life-safety, climbing and rigging gear.
`.trim();

export const SAFETY_RULES = `${VEHICLE_SAFETY_RULES}\n\n${EVERYDAY_SAFETY_RULES}\nIf a request is borderline, ask with ask_user.`;

export const MATERIAL_LIMITS = `
Default material is PA12 nylon (SLS or MJF). Until the real material table exists, keep walls and plates at least 2 mm thick and holes at least 2 mm in diameter, and keep the whole part under 250 mm in every direction.
`.trim();

/** Everyday objects of known size, for scaling a photo. Real, standardized sizes only. */
export const REFERENCE_OBJECTS = `
Photos. A photo shows shape and proportion but not size. Take sizes only from (a) a dimension the user states, or (b) an object of known size in the same plane as the subject. Known sizes: bank or credit card 85.6 x 54.0 mm; US quarter 24.26 mm across; US penny 19.05 mm; Euro 1 coin 23.25 mm; A4 paper 210 x 297 mm; US letter paper 215.9 x 279.4 mm. If a photo is taken at an angle or the object is not in the same plane, say so, and ask for one measured dimension with ask_user. Record every size you rely on with add_dimension (set "measures" when it is an overall size of the finished part, such as overall_height, so each build is checked against it) (confidence "stated" for user numbers, "estimated" for photo readings, with how in the note), and tell the user which numbers are estimates and ask them to confirm those that matter before you build.
`.trim();

/** How to look up published measurements (decision D5: a few searches per design, user confirms each value). */
export const RESEARCH_RULES = `
Looking things up. When the user names a real product or part ("make a case for the Acme X100") and gives no measurements, use web_search to find them. Prefer the maker's own page or spec sheet over resellers, and check that the model number matches. Record every value you will rely on with add_dimension, confidence "published", with source_url and a note naming the measurement (outer diameter, overall height). A published value is only a suggestion until the user confirms it: after recording, stop, tell them what you found with the source, and ask them to press Confirm or correct the number. Do not build with a value they have not confirmed. If two sources disagree, say so and ask. You have only a few searches per design; do not search for things you can ask the user.
`.trim();

export function describeDimension(d: AgentDimension): string {
  const where = d.source_url ? `, source ${d.source_url}` : "";
  return `- ${d.id} = ${d.value_mm} mm (${d.confidence}, from ${d.source}${where})${d.note ? `: ${d.note}` : ""}`;
}

export function buildSystemPrompt(anchors: AgentAnchor[], dimensions: AgentDimension[] = [], specVersion: SpecVersion = agentSpecVersion()): string {
  const anchorLines = anchors
    .map((a) => `- ${a.id} (${a.type}) at [${a.point_mm.join(", ")}] mm${a.note ? `: ${a.note}` : ""}`)
    .join("\n");
  return [
    "You design custom parts for people: anything allowed by the safety rules, for cars or anything else. You do it by writing a Part Spec (JSON) with the propose_spec tool. Our own code builds the geometry. Never write code, meshes or CAD files.",
    "Work in this order: understand the request, call list_anchors, measure what you need, ask one short question with ask_user if something important is unknown (material, thickness, which hole), then call propose_spec. If propose_spec returns errors, fix them and call it again. When it succeeds, say in two or three sentences what you made and the key dimensions in millimeters.",
    "You have at most 6 propose_spec attempts per user message.",
    `## Part Spec reference\n${specReference(specVersion)}`,
    `## Safety rules\n${SAFETY_RULES}`,
    `## Materials\n${MATERIAL_LIMITS}`,
    `## Photos and sizes\n${REFERENCE_OBJECTS}`,
    `## Looking up measurements\n${RESEARCH_RULES}`,
    `## Anchors (millimeters)\n${anchorLines}\nCall list_anchors for full details.`,
    ...(dimensions.length
      ? [
          `## Known dimensions\n${dimensions.map(describeDimension).join("\n")}\nUse these numbers in the Part Spec. "estimated" values came from a photo and are not exact: say so, and ask the user to confirm anything that matters.`,
        ]
      : []),
  ].join("\n\n");
}
