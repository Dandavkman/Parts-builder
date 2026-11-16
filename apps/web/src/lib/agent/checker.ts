import type Anthropic from "@anthropic-ai/sdk";
import type { AgentImage } from "./request";
import type { TokenUsage } from "./types";

/**
 * A second opinion on likeness. The model that built a part tends to call it finished, so a separate
 * request, which sees only the user's photos and a picture of the built part, lists what differs.
 * It never sees the conversation, the spec or the builder's reasoning.
 */
export const DEFAULT_CHECK_MODEL = "claude-opus-5-5";
export const MAX_DIFFERENCES = 5;

export const CHECKER_SYSTEM = `
You compare photos of a real object with a picture of a CAD model that is meant to recreate it. You did not build the model.
The first images are the user's reference photos. The last image is the CAD model: four views on one sheet: front (top left), side (top right), top (bottom left), and bottom right an angled view, drawn from about where the photo's camera stood when that is known. The views are flat (no perspective), each is zoomed to fit its panel, and the white bar at the bottom left of each panel stands for the same length, so use it to compare sizes between panels.
Judge shape only: the outline from each side, proportions (ratios such as height to width), which edges are curved or straight, how many parts there are and how they join, gaps and openings, thickness. Ignore color, material, surface finish, logos, text, background, lighting and camera angle. Ignore things in the photo that are not the part (the car, a hand, a table). Do not ask for fasteners or mounting holes unless they are plainly visible in the photo.
List the differences that most change how the part looks, most important first, at most ${MAX_DIFFERENCES}. Each one is a single plain sentence that says where it is, what the photo shows and what the model shows, so the builder can act on it (for example "End plates: in the photo they curve inward toward the bottom; in the model they are flat and vertical."). Do not suggest CAD operations or sizes in millimeters.
Set "matches" to true only when a person would look at the model and say it is the same part as the photo, with no difference left that changes the look. When unsure, say false.
`.trim();

const FORMAT = {
  type: "json_schema",
  schema: {
    type: "object",
    properties: {
      matches: { type: "boolean" },
      differences: { type: "array", items: { type: "string" } },
    },
    required: ["matches", "differences"],
    additionalProperties: false,
  },
} as const;

export interface Likeness {
  matches: boolean;
  differences: string[];
  usage: TokenUsage;
}

/** Compares a picture of the built part (base64 PNG) with the user's photos. Null when it could not run. */
export type CheckLikeness = (picture: string) => Promise<Likeness | null>;

/** Reads the checker's JSON reply. Returns null for anything that is not the expected shape. */
export function parseLikeness(text: string): Pick<Likeness, "matches" | "differences"> | null {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return null;
  }
  const { matches, differences } = (value ?? {}) as { matches?: unknown; differences?: unknown };
  if (typeof matches !== "boolean" || !Array.isArray(differences)) return null;
  const list = differences
    .filter((d): d is string => typeof d === "string" && d.trim() !== "")
    .map((d) => d.trim().slice(0, 400))
    .slice(0, MAX_DIFFERENCES);
  return { matches: matches && list.length === 0, differences: list };
}

/** What the builder is told. Plain text, so it is also kept in the saved conversation. */
export function describeLikeness(result: Pick<Likeness, "matches" | "differences">): string {
  if (result.matches) {
    return "Likeness check: an independent checker compared this picture with the user's photo and found the shape matches. Do not rebuild for likeness; finish and tell the user what is estimated.";
  }
  return [
    "Likeness check: an independent checker compared this picture with the user's photo and found these differences, most important first:",
    ...result.differences.map((d, i) => `${i + 1}. ${d}`),
    "Fix them in that order and build again while you have attempts and pictures left. If you leave one unfixed, tell the user which and why.",
  ].join("\n");
}

/** Whether the checker runs: on unless DESIGN_AGENT_CHECK=off. It only ever runs for designs with a photo. */
export function checkEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return (env.DESIGN_AGENT_CHECK ?? "").trim().toLowerCase() !== "off";
}

/** The checker for one design's photos. Never throws: a failed check must not stop a design. */
export function anthropicChecker(client: Anthropic, photos: AgentImage[], model: string = process.env.DESIGN_AGENT_CHECK_MODEL || DEFAULT_CHECK_MODEL): CheckLikeness {
  return async (picture) => {
    try {
      const message = await client.messages.create({
        model,
        max_tokens: 8000,
        system: CHECKER_SYSTEM,
        output_config: { effort: "medium", format: FORMAT },
        messages: [
          {
            role: "user",
            content: [
              ...photos.map((p) => ({ type: "image" as const, source: { type: "base64" as const, media_type: p.mediaType, data: p.base64 } })),
              { type: "text", text: "Above: the user's reference photos. Next: the CAD model." },
              { type: "image", source: { type: "base64", media_type: "image/png", data: picture } },
              { type: "text", text: "Compare them." },
            ],
          },
        ],
      });
      if (message.stop_reason !== "end_turn") return null;
      const text = message.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
      const parsed = parseLikeness(text);
      if (!parsed) return null;
      const u = message.usage;
      return {
        ...parsed,
        usage: {
          input_tokens: u.input_tokens,
          output_tokens: u.output_tokens,
          cache_creation_input_tokens: u.cache_creation_input_tokens ?? 0,
          cache_read_input_tokens: u.cache_read_input_tokens ?? 0,
        },
      };
    } catch {
      return null;
    }
  };
}
