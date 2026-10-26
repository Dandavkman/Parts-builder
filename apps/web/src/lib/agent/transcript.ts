import type { ChatItem } from "./chat-state";

interface Block {
  type?: string;
  text?: string;
  id?: string;
  name?: string;
  input?: { question?: unknown };
  tool_use_id?: string;
  content?: unknown;
  is_error?: boolean;
}

/**
 * Turns a saved conversation back into chat items for the page: what the user typed, what the
 * agent said and asked. Tool traffic is left out, except the user's answers to `ask_user`.
 */
export function itemsFromHistory(
  history: { role: string; content?: unknown }[],
): ChatItem[] {
  const items: ChatItem[] = [];
  const questions = new Set<string>();
  for (const { role, content } of history) {
    if (typeof content === "string") {
      if (role === "user") items.push({ kind: "user", text: content });
      continue;
    }
    if (!Array.isArray(content)) continue;
    for (const block of content as Block[]) {
      if (role === "assistant" && block.type === "text" && block.text) {
        items.push({ kind: "assistant", text: block.text });
      } else if (
        role === "assistant" &&
        block.type === "tool_use" &&
        block.name === "ask_user" &&
        block.id
      ) {
        questions.add(block.id);
        items.push({
          kind: "assistant",
          text: String(block.input?.question ?? ""),
        });
      } else if (
        role === "user" &&
        block.type === "tool_result" &&
        !block.is_error &&
        block.tool_use_id &&
        questions.has(block.tool_use_id) &&
        typeof block.content === "string"
      ) {
        items.push({ kind: "user", text: block.content });
      }
    }
  }
  return items;
}
