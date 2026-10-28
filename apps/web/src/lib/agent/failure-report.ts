import type { BenchmarkCase } from "./benchmark";

/** One design as the logs hold it: its saved conversation and every version the agent tried. */
export interface LoggedDesign {
  id: string;
  history: { role: string; content?: unknown }[];
  versions: { version: number; buildOk: boolean; buildErrors: string[] }[];
}

export type Outcome = "built" | "never_built" | "last_failed";

interface Block {
  type?: string;
  text?: string;
}

/** What the user first asked for, in their words. */
export function firstRequest(history: LoggedDesign["history"]): string {
  for (const { role, content } of history) {
    if (role !== "user") continue;
    if (typeof content === "string") return content.trim();
    if (Array.isArray(content)) {
      const text = (content as Block[]).find((b) => b.type === "text" && b.text)?.text;
      if (text) return text.trim();
    }
  }
  return "";
}

export function outcomeOf(design: LoggedDesign): Outcome {
  if (design.versions.length === 0) return "never_built";
  const last = design.versions.reduce((a, b) => (b.version > a.version ? b : a));
  return last.buildOk ? "built" : "last_failed";
}

/** Makes error text comparable across designs: numbers and ids become #, and case and spacing are ignored. */
export function normalizeReason(text: string): string {
  return text
    .toLowerCase()
    .replace(/[0-9a-f]{8}-[0-9a-f-]{27}/g, "#")
    .replace(/-?\d+(\.\d+)?/g, "#")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

/** Why a design failed: the last version's first build error, or that the agent never produced a spec. */
export function failureReason(design: LoggedDesign): string | null {
  const outcome = outcomeOf(design);
  if (outcome === "built") return null;
  if (outcome === "never_built") return "no spec was produced";
  const last = design.versions.reduce((a, b) => (b.version > a.version ? b : a));
  return normalizeReason(last.buildErrors[0] ?? "the build failed with no message");
}

export interface FailureGroup {
  reason: string;
  count: number;
  /** Up to three of the requests that hit it. */
  examples: string[];
}

/** The most common ways designs failed, biggest first. Ties break alphabetically so the report is stable. */
export function topFailures(designs: LoggedDesign[], n = 10): FailureGroup[] {
  const groups = new Map<string, FailureGroup>();
  for (const d of designs) {
    const reason = failureReason(d);
    if (!reason) continue;
    const g = groups.get(reason) ?? { reason, count: 0, examples: [] };
    g.count += 1;
    const request = firstRequest(d.history);
    if (request && g.examples.length < 3 && !g.examples.includes(request)) g.examples.push(request);
    groups.set(reason, g);
  }
  return [...groups.values()].sort((a, b) => b.count - a.count || a.reason.localeCompare(b.reason)).slice(0, n);
}

/** Share of designs whose last version built, as a number from 0 to 1. Zero designs gives 0. */
export function successRate(designs: LoggedDesign[]): number {
  if (designs.length === 0) return 0;
  return designs.filter((d) => outcomeOf(d) === "built").length / designs.length;
}

/** Drafts of benchmark cases from the failed requests. Sizes are left for a person to fill in before they count. */
export function benchmarkCandidates(groups: FailureGroup[], limit = 10): BenchmarkCase[] {
  const seen = new Set<string>();
  const out: BenchmarkCase[] = [];
  for (const g of groups) {
    for (const prompt of g.examples) {
      if (seen.has(prompt) || out.length >= limit) continue;
      seen.add(prompt);
      out.push({ id: `failed-${out.length + 1}`, prompt, dimensions: [] });
    }
  }
  return out;
}

/** The numbers B3.9 reports: before and after, as percentages with one decimal. */
export function compareRates(before: LoggedDesign[], after: LoggedDesign[]): string {
  const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
  const b = successRate(before);
  const a = successRate(after);
  return `Built on the last try: ${pct(b)} of ${before.length} before, ${pct(a)} of ${after.length} after (${a >= b ? "+" : ""}${((a - b) * 100).toFixed(1)} points).`;
}
