// Live everyday benchmark (B1.20). Costs API tokens and needs the geometry service, so it only runs on demand:
//   BENCH=1 ANTHROPIC_API_KEY=... GEOMETRY_SERVICE_URL=... GEOMETRY_SERVICE_TOKEN=... pnpm bench
// The report is written to benchmarks/results/. Without BENCH=1 this file is skipped.
import Anthropic from "@anthropic-ai/sdk";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "vitest";
import { EVERYDAY_CASES, reportTable, scoreRun, type BenchmarkRow } from "./benchmark";
import { buildWithGeometryService } from "./geometry-client";
import { anthropicTurn, DEFAULT_MODEL, runAgent } from "./loop";
import { buildSystemPrompt } from "./prompt";
import type { AgentEvent } from "./types";

describe.skipIf(!process.env.BENCH)("everyday benchmark (live)", () => {
  it("runs the five cases and writes a report", { timeout: 15 * 60 * 1000 }, async () => {
    const model = process.env.DESIGN_AGENT_MODEL || DEFAULT_MODEL;
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const rows: BenchmarkRow[] = [];
    for (const c of EVERYDAY_CASES) {
      const events: AgentEvent[] = [];
      const run = await runAgent({
        turn: anthropicTurn(client),
        model,
        system: buildSystemPrompt([], c.dimensions),
        history: [{ role: "user", content: c.prompt }],
        anchors: [],
        dimensions: c.dimensions,
        build: buildWithGeometryService,
        emit: (e) => events.push(e),
      });
      rows.push(scoreRun(c.id, events, run.usage, run.attempts));
    }
    const date = new Date().toISOString().slice(0, 10);
    const dir = path.resolve(__dirname, "../../../../../benchmarks/results");
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, `everyday-${date}.md`), reportTable(rows, { model, date }));
  });
});
