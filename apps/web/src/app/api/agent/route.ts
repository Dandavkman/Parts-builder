import Anthropic from "@anthropic-ai/sdk";
import { buildWithGeometryService } from "../../../lib/agent/geometry-client";
import { anthropicTurn, DEFAULT_MODEL, runAgent } from "../../../lib/agent/loop";
import { buildSystemPrompt } from "../../../lib/agent/prompt";
import { countWebSearches, WEB_SEARCHES_PER_DESIGN } from "../../../lib/agent/tools";
import { parseRequest } from "../../../lib/agent/request";
import {
  addPhoto,
  createDesign,
  getOwnedDesign,
  loadHistory,
  loadPhotos,
  loadReferences,
  recorderFor,
  saveDimension,
  withPhotos,
  withUserMessage,
} from "../../../lib/agent/store";
import type { AgentEvent } from "../../../lib/agent/types";
import { DatabaseNotConfigured, getDb } from "../../../lib/db/client";
import { requireOwner } from "../../../lib/require-owner";

export const maxDuration = 300;

/** Web lookups are on unless `DESIGN_AGENT_WEB_SEARCH=off` (for example if the Console has not enabled the tool). */
const webSearchEnabled = () => process.env.DESIGN_AGENT_WEB_SEARCH !== "off";

/** A short, secret-free reason for the chat. API errors carry a status and message; our own errors are plain text. */
function describeFailure(error: unknown): string {
  const base = "The design agent hit a problem. Please try again.";
  if (error instanceof Anthropic.APIError) {
    return `${base} (model API ${error.status ?? "error"}: ${error.message.slice(0, 200)})`;
  }
  if (error instanceof Error && error.message) return `${base} (${error.message.slice(0, 200)})`;
  return base;
}

/**
 * Design agent. Takes `{ design_id?, message }`, continues that design's saved conversation (or starts
 * a new design) and streams one JSON event per line. Every message and spec version is saved.
 * Anchors and dimensions come from the design's references; until it has one, a fixture panel stands in for a scan.
 */
export async function POST(request: Request) {
  const who = await requireOwner();
  if ("response" in who) return who.response;
  const { ownerId } = who;
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
  if (parsed.image && !(await addPhoto(db, designId, parsed.image))) {
    return Response.json({ error: "This design already has the most photos allowed." }, { status: 400 });
  }
  const references = await loadReferences(db, designId);
  const history = withUserMessage(saved, parsed.message);
  const photos = await loadPhotos(db, designId);
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
          system: buildSystemPrompt(references.anchors, references.dimensions),
          history: withPhotos(history, photos),
          anchors: references.anchors,
          dimensions: references.dimensions,
          build: buildWithGeometryService,
          emit,
          record,
          searchesLeft: webSearchEnabled() ? Math.max(0, WEB_SEARCHES_PER_DESIGN - countWebSearches(saved)) : 0,
          saveDimension: (dimension) => saveDimension(db, designId, dimension),
        });
      } catch (error) {
        console.error("design agent failed", error);
        emit({ type: "error", message: describeFailure(error) });
      }
      controller.close();
    },
  });
  return new Response(stream, {
    headers: { "content-type": "application/x-ndjson", "cache-control": "private, no-store" },
  });
}
