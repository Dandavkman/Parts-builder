import type Anthropic from "@anthropic-ai/sdk";
import type { AgentAnchor, BuildOutcome } from "./types";

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
