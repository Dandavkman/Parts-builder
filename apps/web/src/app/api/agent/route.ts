import Anthropic from "@anthropic-ai/sdk";
import { auth } from "@clerk/nextjs/server";
import { FIXTURE_ANCHORS } from "../../../lib/agent/fixture-anchors";
import { buildWithGeometryService } from "../../../lib/agent/geometry-client";
import { anthropicTurn, DEFAULT_MODEL, runAgent } from "../../../lib/agent/loop";
import { buildSystemPrompt } from "../../../lib/agent/prompt";
import { parseChat } from "../../../lib/agent/request";
import type { AgentEvent } from "../../../lib/agent/types";
import { getAuthMode } from "../../../lib/auth-mode";

export const maxDuration = 300;

/**
 * Design agent (B1.8a). Takes the chat so far and streams one JSON event per line.
 * Anchors are fixtures until anchor fitting (B1.5) exists; nothing is saved until B1.8b.
 */
export async function POST(request: Request) {
  const mode = getAuthMode();
  if (mode === "unconfigured") return Response.json({ error: "Auth is not configured" }, { status: 503 });
  if (mode === "clerk") {
    const { userId } = await auth();
    if (!userId) return Response.json({ error: "Sign in required" }, { status: 401 });
  }
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return Response.json({ error: "The design agent is not configured." }, { status: 503 });

  const history = parseChat(await request.json().catch(() => null));
  if (typeof history === "string") return Response.json({ error: history }, { status: 400 });

  const client = new Anthropic({ apiKey });
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (event: AgentEvent) => controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      try {
        await runAgent({
          turn: anthropicTurn(client),
          model: process.env.DESIGN_AGENT_MODEL || DEFAULT_MODEL,
          system: buildSystemPrompt(FIXTURE_ANCHORS),
          history,
          anchors: FIXTURE_ANCHORS,
          build: buildWithGeometryService,
          emit,
        });
      } catch (error) {
        console.error("design agent failed", error);
        emit({ type: "error", message: "The design agent hit a problem. Please try again." });
      }
      controller.close();
    },
  });
  return new Response(stream, {
    headers: { "content-type": "application/x-ndjson", "cache-control": "private, no-store" },
  });
}
