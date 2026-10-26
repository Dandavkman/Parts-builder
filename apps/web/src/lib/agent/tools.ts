import type Anthropic from "@anthropic-ai/sdk";
import type { AgentAnchor, AgentDimension, BuildOutcome } from "./types";

export const TOOLS: Anthropic.Beta.BetaTool[] = [
  {
    name: "list_anchors",
    description: "List the reference points, planes and holes the user picked on the scan, with positions in millimeters.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "measure",
    description: "Distance in millimeters between two anchors, by id.",
    input_schema: {
      type: "object",
      properties: { from: { type: "string" }, to: { type: "string" } },
      required: ["from", "to"],
      additionalProperties: false,
    },
  },
  {
    name: "add_dimension",
    description:
      "Record a real-world length for this design, in millimeters, so it is remembered and shown to the user. Use confidence 'stated' for a number the user gave, and 'estimated' for a size you read from a photo using a stated dimension or a reference object of known size. Never record an estimate without saying how you got it in 'note'.",
    input_schema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Lowercase letters, digits and underscores, such as vase_height." },
        value_mm: { type: "number", description: "The length in millimeters." },
        confidence: { type: "string", enum: ["stated", "estimated"] },
        note: { type: "string", description: "How you know it, such as 'user said 20 cm' or 'scaled from the coin in the photo'." },
      },
      required: ["id", "value_mm", "confidence", "note"],
      additionalProperties: false,
    },
  },
  {
    name: "propose_spec",
    description:
      "Submit a complete Part Spec v1. Returns whether it builds, and a plain sentence for every problem if it does not.",
    input_schema: {
      type: "object",
      properties: { spec: { type: "object", description: "The full Part Spec JSON." } },
      required: ["spec"],
      additionalProperties: false,
    },
  },
  {
    name: "ask_user",
    description: "Ask the user one short clarifying question, such as the material or thickness. The turn ends until they answer.",
    input_schema: {
      type: "object",
      properties: { question: { type: "string" } },
      required: ["question"],
      additionalProperties: false,
    },
  },
];

export function distanceMm(anchors: AgentAnchor[], from: unknown, to: unknown): number | string {
  const a = anchors.find((x) => x.id === from);
  const b = anchors.find((x) => x.id === to);
  if (!a || !b) return `Unknown anchor. Known anchors: ${anchors.map((x) => x.id).join(", ")}.`;
  return Math.hypot(...a.point_mm.map((v, i) => v - b.point_mm[i]));
}

export function formatBuildOutcome(outcome: BuildOutcome): string {
  return outcome.ok
    ? "The spec built successfully."
    : `The spec did not build:\n${outcome.errors.map((e) => `- ${e}`).join("\n")}`;
}

const DIMENSION_ID = /^[a-z][a-z0-9_]{0,39}$/;

/** Checks the model's `add_dimension` input. Returns the dimension, or a sentence the model can act on. */
export function parseDimension(input: Record<string, unknown>): AgentDimension | string {
  const { id, value_mm, confidence, note } = input;
  if (typeof id !== "string" || !DIMENSION_ID.test(id)) return "id must be lowercase letters, digits and underscores, starting with a letter.";
  if (typeof value_mm !== "number" || !Number.isFinite(value_mm) || value_mm <= 0 || value_mm > 5000) {
    return "value_mm must be a number above 0 and at most 5000.";
  }
  if (confidence !== "stated" && confidence !== "estimated") return "confidence must be 'stated' or 'estimated'.";
  if (typeof note !== "string" || note.trim() === "") return "note must say how you know the value.";
  return {
    id,
    value_mm,
    source: confidence === "stated" ? "user" : "photo",
    confidence,
    note: note.slice(0, 200),
  };
}
