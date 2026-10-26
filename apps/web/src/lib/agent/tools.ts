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
        confidence: {
          type: "string",
          enum: ["stated", "estimated", "published"],
          description: "'published' is for a value you found on a web page; it needs source_url, and the user must confirm it before it can be used.",
        },
        note: { type: "string", description: "How you know it, such as 'user said 20 cm', 'scaled from the coin in the photo' or 'spec sheet, outer diameter'." },
        source_url: { type: "string", description: "The https page the value came from. Required when confidence is 'published'." },
        measures: {
          type: "string",
          enum: ["overall_width", "overall_length", "overall_height", "overall_diameter"],
          description: "Set this when the value is an overall size of the finished part (X, Y, Z up, or the larger of X and Y for a round part). We then check every build against it and tell you if it is off.",
        },
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

export function formatBuildOutcome(outcome: BuildOutcome, checks: string[] = []): string {
  return outcome.ok
    ? ["The spec built successfully.", ...checks].join("\n")
    : `The spec did not build:\n${outcome.errors.map((e) => `- ${e}`).join("\n")}`;
}

const MEASURES = ["overall_width", "overall_length", "overall_height", "overall_diameter"];
const DIMENSION_ID = /^[a-z][a-z0-9_]{0,39}$/;

/** Checks the model's `add_dimension` input. Returns the dimension, or a sentence the model can act on. */
export function parseDimension(input: Record<string, unknown>): AgentDimension | string {
  const { id, value_mm, confidence, note, source_url, measures } = input;
  if (typeof id !== "string" || !DIMENSION_ID.test(id)) return "id must be lowercase letters, digits and underscores, starting with a letter.";
  if (typeof value_mm !== "number" || !Number.isFinite(value_mm) || value_mm <= 0 || value_mm > 5000) {
    return "value_mm must be a number above 0 and at most 5000.";
  }
  if (confidence !== "stated" && confidence !== "estimated" && confidence !== "published") {
    return "confidence must be 'stated', 'estimated' or 'published'.";
  }
  if (typeof note !== "string" || note.trim() === "") return "note must say how you know the value.";
  if (measures !== undefined && !MEASURES.includes(measures as never)) {
    return `measures must be one of ${MEASURES.join(", ")}.`;
  }
  const base = {
    id,
    value_mm,
    confidence,
    note: note.slice(0, 200),
    ...(measures !== undefined ? { measures: measures as NonNullable<AgentDimension["measures"]> } : {}),
  } as const;
  if (confidence !== "published") return { ...base, source: confidence === "stated" ? "user" : "photo" };
  if (typeof source_url !== "string" || !/^https:\/\/[^\s]{4,500}$/.test(source_url)) {
    return "A published value needs source_url, the https page it came from.";
  }
  return { ...base, source: "researched", source_url };
}

/** Web searches one design may use in total (decision D5). Each costs about 1 cent. */
export const WEB_SEARCHES_PER_DESIGN = 5;

/** How many web searches a saved conversation has already used. */
export function countWebSearches(history: { content?: unknown }[]): number {
  let used = 0;
  for (const { content } of history) {
    if (!Array.isArray(content)) continue;
    for (const block of content as { type?: string; name?: string }[]) {
      if (block.type === "server_tool_use" && block.name === "web_search") used += 1;
    }
  }
  return used;
}

/** The server-side web search tool, limited to the searches a design has left. */
export function webSearchTool(searchesLeft: number): Anthropic.Beta.BetaWebSearchTool20250305 {
  return { type: "web_search_20250305", name: "web_search", max_uses: searchesLeft };
}
