import Anthropic from "@anthropic-ai/sdk";
import { auth } from "@clerk/nextjs/server";
import { FIXTURE_ANCHORS } from "../../../lib/agent/fixture-anchors";
import { buildWithGeometryService } from "../../../lib/agent/geometry-client";
import { anthropicTurn, DEFAULT_MODEL, runAgent } from "../../../lib/agent/loop";
import { buildSystemPrompt } from "../../../lib/agent/prompt";
import { parseRequest } from "../../../lib/agent/request";
import { createDesign, getOwnedDesign, loadHistory, recorderFor, withUserMessage } from "../../../lib/agent/store";
import type { AgentEvent } from "../../../lib/agent/types";
import { getAuthMode } from "../../../lib/auth-mode";
import { DatabaseNotConfigured, getDb } from "../../../lib/db/client";

export const maxDuration = 300;

/**
 * Design agent. Takes `{ design_id?, message }`, continues that design's saved conversation (or starts
 * a new design) and streams one JSON event per line. Every message and spec version is saved.
 * Anchors are fixtures until anchor fitting (B1.5) exists.
 */
export async function POST(request: Request) {
  const mode = getAuthMode();
  if (mode === "unconfigured") return Response.json({ error: "Auth is not configured" }, { status: 503 });
  let ownerId = "dev";
  if (mode === "clerk") {
    const { userId } = await auth();
    if (!userId) return Response.json({ error: "Sign in required" }, { status: 401 });
    ownerId = userId;
  }
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return Response.json({ error: "The design agent is not configured." }, { status: 503 });

  const parsed = parseRequest(await request.json().catch(() => null));
  if (typeof parsed === "string") return Response.json({ error: parsed }, { status: 400 });

  let db;
  try {
    db = await getDb();
  } catch (error) {
    if (error instanceof DatabaseNotConfigured) {
      return Response.json({ error: "The database is not configured." }, { status: 503 });
    }
    console.error("database unavailable", error);
    return Response.json({ error: "The database is not reachable." }, { status: 503 });
  }

  let designId = parsed.designId;
  let saved: Awaited<ReturnType<typeof loadHistory>> = [];
  if (designId) {
    if (!(await getOwnedDesign(db, designId, ownerId))) {
      return Response.json({ error: "Design not found." }, { status: 404 });
    }
    saved = await loadHistory(db, designId);
  } else {
    designId = await createDesign(db, ownerId, parsed.message);
  }
  const history = withUserMessage(saved, parsed.message);
  const record = recorderFor(db, designId);

  const client = new Anthropic({ apiKey });
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (event: AgentEvent) => controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      try {
        emit({ type: "design", design_id: designId });
        await record.message({ role: "user", content: history.at(-1)!.content });
        await runAgent({
          turn: anthropicTurn(client),
          model: process.env.DESIGN_AGENT_MODEL || DEFAULT_MODEL,
          system: buildSystemPrompt(FIXTURE_ANCHORS),
          history,
          anchors: FIXTURE_ANCHORS,
          build: buildWithGeometryService,
          emit,
          record,
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
