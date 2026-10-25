import { PART_SPEC_V1_EXAMPLES, PART_SPEC_V1_SCHEMA } from "./generated/part-spec-v1-reference";
import type { AgentAnchor } from "./types";

/** How a spec is put together. The exact fields come from the schema and examples quoted below. */
export const SPEC_CONVENTIONS = `
Part Spec v1 is JSON: {"spec_version": "1.0", "name": "...", "features": [...]}.
Lengths are millimeters (_mm), angles degrees (_deg). Every feature has a unique "id" (lowercase letters, digits, underscore) and a "type".
Only a plate has a "placement": {"anchor": "<anchor id or origin>", "offset_mm": [x, y, z], "rotation_deg": n}. Never write absolute positions.
Every other feature names its plate in "plate" and uses "position_mm": [x, y] in that plate's frame, origin at the plate center.
A rectangular plate is {"kind": "rectangle", "width_mm": ..., "length_mm": ...}; a polygon plate is {"kind": "polygon", "points_mm": [[x, y], ...]}. There is no round outline: use a polygon with many points, and fillets for rounded edges.
Use only the fields in the schema. Never invent field names. The schema rejects extra fields.
The builder reports every problem in plain sentences, for example "hole 'hole_2' ... is outside plate 'base'". Schema errors name the field path, such as "features/0/outline: 'kind' is a required property". When you get one, find that field in the schema and the examples below and copy the shape exactly. Do not guess again.
`.trim();

export function specReference(): string {
  return [
    SPEC_CONVENTIONS,
    `JSON Schema for Part Spec v1 (authoritative):\n${JSON.stringify(PART_SPEC_V1_SCHEMA)}`,
    `Valid example specs, one or more per feature:\n${PART_SPEC_V1_EXAMPLES.map((e) => JSON.stringify(e)).join("\n")}`,
  ].join("\n\n");
}

export const SAFETY_RULES = `
Allowed: mounts and brackets, interior parts (gauge pods, switch panels, trim, cup holders), covers and trim (blanking plates, badges, grommets).
Needs review (design it, but tell the user it cannot be ordered until an admin approves): anything near the exhaust or turbo, and intake or exhaust parts that change engine airflow.
Blocked (refuse in plain words, do not call propose_spec): brakes, suspension, steering, wheels and hubs, seat and seatbelt mounts, airbag areas, fuel system, tow points.
Out of scope: non-automotive parts. If a request is borderline, ask with ask_user.
`.trim();

export const MATERIAL_LIMITS = `
Default material is PA12 nylon (SLS or MJF). Until the real material table exists, keep walls and plates at least 2 mm thick and holes at least 2 mm in diameter, and keep the whole part under 250 mm in every direction.
`.trim();

export function buildSystemPrompt(anchors: AgentAnchor[]): string {
  const anchorLines = anchors
    .map((a) => `- ${a.id} (${a.type}) at [${a.point_mm.join(", ")}] mm${a.note ? `: ${a.note}` : ""}`)
    .join("\n");
  return [
    "You design custom car parts for people. You do it by writing a Part Spec (JSON) with the propose_spec tool. Our own code builds the geometry. Never write code, meshes or CAD files.",
    "Work in this order: understand the request, call list_anchors, measure what you need, ask one short question with ask_user if something important is unknown (material, thickness, which hole), then call propose_spec. If propose_spec returns errors, fix them and call it again. When it succeeds, say in two or three sentences what you made and the key dimensions in millimeters.",
    "You have at most 6 propose_spec attempts per user message.",
    `## Part Spec reference\n${specReference()}`,
    `## Safety rules\n${SAFETY_RULES}`,
    `## Materials\n${MATERIAL_LIMITS}`,
    `## Anchors on the scan (millimeters)\n${anchorLines}\nCall list_anchors for full details.`,
  ].join("\n\n");
}
