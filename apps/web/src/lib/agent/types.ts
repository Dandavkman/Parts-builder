/** A reference the user picked on the scan. Positions are millimeters in the scan frame. */
export interface AgentAnchor {
  id: string;
  type: "point" | "plane" | "hole" | "axis";
  point_mm: [number, number, number];
  normal: [number, number, number];
  diameter_mm?: number;
  note?: string;
}

/**
 * A named length that is not a position, such as "vase height 200 mm". It comes from the user, from a
 * photo read against a known size, or from a published source. Dimensions never reach the geometry
 * service; the agent reads them and writes the numbers into the Part Spec, and the dimension check
 * (B1.18) compares the built part against them.
 */
export interface AgentDimension {
  id: string;
  value_mm: number;
  source: "user" | "photo" | "researched";
  /** Where a researched value came from. */
  source_url?: string;
  /** How far to trust it: stated by the user, estimated from a photo, or published by a maker. */
  confidence: "stated" | "estimated" | "published";
  note?: string;
}

/** Everything a design knows about the real object: anchors for placement, and dimensions. */
export interface DesignReferences {
  anchors: AgentAnchor[];
  dimensions: AgentDimension[];
}

export type ReferenceKind = "photo" | "researched" | "scan" | "stated";

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
