/** A reference the user picked on the scan. Positions are millimeters in the scan frame. */
export interface AgentAnchor {
  id: string;
  type: "point" | "plane" | "hole" | "axis";
  point_mm: [number, number, number];
  normal: [number, number, number];
  diameter_mm?: number;
  note?: string;
}

export interface TokenUsage {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens: number;
  cache_read_input_tokens: number;
}

/** What the geometry service said about a proposed spec. */
export type BuildOutcome = { ok: true } | { ok: false; errors: string[] };

export type BuildSpec = (spec: Record<string, unknown>, anchors: AgentAnchor[]) => Promise<BuildOutcome>;

/** Events streamed to the browser, one JSON object per line. */
export type AgentEvent =
  | { type: "design"; design_id: string }
  | { type: "text"; delta: string }
  | { type: "tool"; name: string; summary: string }
  | { type: "spec"; attempt: number; ok: boolean; errors: string[]; spec: Record<string, unknown> }
  | { type: "question"; question: string }
  | { type: "usage"; usage: TokenUsage }
  | { type: "done"; outcome: AgentOutcome; attempts: number }
  | { type: "error"; message: string };

export type AgentOutcome = "answered" | "asked" | "attempts_exhausted" | "refused" | "step_limit";
