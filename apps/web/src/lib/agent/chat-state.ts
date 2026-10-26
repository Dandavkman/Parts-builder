import type { AgentEvent } from "./types";

export type ChatItem =
  | { kind: "user"; text: string }
  | { kind: "assistant"; text: string }
  | { kind: "status"; text: string }
  | { kind: "error"; text: string };

export interface ChatState {
  designId: string | null;
  items: ChatItem[];
  /** Counts specs that built; the part viewer reloads when it changes. */
  builtCount: number;
  busy: boolean;
}

export const initialChat: ChatState = { designId: null, items: [], builtCount: 0, busy: false };

/** Reopens a saved design: its transcript replaces whatever the page showed. */
export function openDesign(designId: string, items: ChatItem[]): ChatState {
  return { designId, items, builtCount: 0, busy: false };
}

export function sendMessage(state: ChatState, text: string): ChatState {
  return { ...state, busy: true, items: [...state.items, { kind: "user", text }] };
}

const TOOL_LABELS: Record<string, string> = {
  list_anchors: "Looked at the anchors",
  measure: "Measured",
};

/** Applies one streamed event to the chat. Pure, so the page logic is testable without a browser. */
export function applyEvent(state: ChatState, event: AgentEvent): ChatState {
  switch (event.type) {
    case "design":
      return { ...state, designId: event.design_id };
    case "text": {
      const last = state.items.at(-1);
      if (last?.kind === "assistant") {
        return { ...state, items: [...state.items.slice(0, -1), { kind: "assistant", text: last.text + event.delta }] };
      }
      return { ...state, items: [...state.items, { kind: "assistant", text: event.delta }] };
    }
    case "tool": {
      const label = TOOL_LABELS[event.name] ?? event.name;
      return { ...state, items: [...state.items, { kind: "status", text: `${label} (${event.summary})` }] };
    }
    case "spec": {
      const text = event.ok
        ? `Attempt ${event.attempt}: the part built`
        : `Attempt ${event.attempt}: ${event.errors.length === 1 ? "1 problem" : `${event.errors.length} problems`}, fixing: ${event.errors.join("; ")}`;
      return { ...state, builtCount: state.builtCount + (event.ok ? 1 : 0), items: [...state.items, { kind: "status", text }] };
    }
    case "dimension": {
      const d = event.dimension;
      if (event.pending) {
        return { ...state, items: [...state.items, { kind: "status", text: `Found ${d.id} = ${d.value_mm} mm online. Please confirm it on the right before I use it.` }] };
      }
      const how = d.confidence === "stated" ? "from you" : d.confidence === "estimated" ? "estimated from the photo" : "published";
      return { ...state, items: [...state.items, { kind: "status", text: `Noted ${d.id} = ${d.value_mm} mm (${how})` }] };
    }
    case "question":
      return { ...state, items: [...state.items, { kind: "assistant", text: event.question }] };
    case "error":
      return { ...state, busy: false, items: [...state.items, { kind: "error", text: event.message }] };
    case "done": {
      const note =
        event.outcome === "refused"
          ? "I can't help with that request."
          : event.outcome === "attempts_exhausted"
            ? "I stopped after 6 attempts. The notes above say what is left."
            : event.outcome === "step_limit"
              ? "I stopped because this took too many steps. Try a simpler request."
              : null;
      return { ...state, busy: false, items: note ? [...state.items, { kind: "status", text: note }] : state.items };
    }
    case "usage":
      return state;
  }
}

/** Splits a stream of NDJSON text into events, keeping any partial last line for the next chunk. */
export function parseLines(buffer: string): { events: AgentEvent[]; rest: string } {
  const lines = buffer.split("\n");
  const rest = lines.pop() ?? "";
  const events: AgentEvent[] = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      events.push(JSON.parse(line) as AgentEvent);
    } catch {
      // A malformed line is skipped rather than breaking the chat.
    }
  }
  return { events, rest };
}
