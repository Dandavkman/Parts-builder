import type { AgentDimension, AgentEvent, TokenUsage } from "./types";

/**
 * The everyday benchmark set (task B1.20): five requests with their stated sizes. The sizes are given
 * to the agent as stated dimensions, so the score is whether the built part matches them.
 */
export interface BenchmarkCase {
  id: string;
  prompt: string;
  dimensions: AgentDimension[];
}

const stated = (id: string, value_mm: number, measures: NonNullable<AgentDimension["measures"]>): AgentDimension => ({
  id,
  value_mm,
  source: "user",
  confidence: "stated",
  measures,
});

export const EVERYDAY_CASES: BenchmarkCase[] = [
  {
    id: "vase",
    prompt: "Design a square vase with ridged sides, 200 mm tall, 2 mm walls, open at the top. It is 80 mm wide.",
    dimensions: [stated("vase_height", 200, "overall_height"), stated("vase_width", 80, "overall_width")],
  },
  {
    id: "box",
    prompt: "Make a storage box with a hollow inside, open at the top, 120 mm long, 80 mm wide and 50 mm tall, with 2 mm walls and rounded corners.",
    dimensions: [stated("box_length", 120, "overall_length"), stated("box_width", 80, "overall_width"), stated("box_height", 50, "overall_height")],
  },
  {
    id: "holder",
    prompt: "A round pen holder, 80 mm across and 100 mm tall, hollow with 2.5 mm walls and an open top.",
    dimensions: [stated("holder_diameter", 80, "overall_diameter"), stated("holder_height", 100, "overall_height")],
  },
  {
    id: "knob",
    prompt: "A round knob with a ridged grip, 40 mm across and 25 mm tall, solid.",
    dimensions: [stated("knob_diameter", 40, "overall_diameter"), stated("knob_height", 25, "overall_height")],
  },
  {
    id: "bracket",
    prompt: "A flat mounting bracket plate, 100 mm long, 30 mm wide and 4 mm thick, with two 5 mm screw holes near the ends.",
    dimensions: [stated("bracket_length", 100, "overall_length"), stated("bracket_width", 30, "overall_width"), stated("bracket_thickness", 4, "overall_height")],
  },
];

export interface BenchmarkRow {
  id: string;
  /** The last spec built. */
  validSpec: boolean;
  /** Dimension notes left on the last built spec; none means every stated size matched. */
  dimensionNotes: string[];
  attempts: number;
  tokens: number;
}

/** Scores one finished run from its streamed events and token usage. */
export function scoreRun(id: string, events: AgentEvent[], usage: TokenUsage, attempts: number): BenchmarkRow {
  const specs = events.filter((e): e is Extract<AgentEvent, { type: "spec" }> => e.type === "spec");
  const lastOk = [...specs].reverse().find((s) => s.ok);
  return {
    id,
    validSpec: lastOk !== undefined,
    dimensionNotes: lastOk ? (lastOk.checks ?? []).filter((c) => c.startsWith("Dimension check")) : [],
    attempts,
    tokens: usage.input_tokens + usage.output_tokens + usage.cache_creation_input_tokens + usage.cache_read_input_tokens,
  };
}

/** A case passes when it built and every stated size matched. */
export const passed = (row: BenchmarkRow): boolean => row.validSpec && row.dimensionNotes.length === 0;

export function reportTable(rows: BenchmarkRow[], meta: { model: string; date: string }): string {
  const lines = [
    `# Everyday benchmark, ${meta.date}`,
    "",
    `Model: ${meta.model}. Passed: ${rows.filter(passed).length} of ${rows.length}.`,
    "",
    "| Case | Valid spec | Dimension check | Attempts | Tokens |",
    "| --- | --- | --- | --- | --- |",
    ...rows.map(
      (r) =>
        `| ${r.id} | ${r.validSpec ? "yes" : "no"} | ${!r.validSpec ? "n/a" : r.dimensionNotes.length ? r.dimensionNotes.join(" ").replaceAll("|", "/") : "all match"} | ${r.attempts} | ${r.tokens} |`,
    ),
    "",
  ];
  return lines.join("\n");
}

