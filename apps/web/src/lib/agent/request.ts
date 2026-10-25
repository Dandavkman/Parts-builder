import type Anthropic from "@anthropic-ai/sdk";

export const MAX_MESSAGES = 20;
export const MAX_MESSAGE_CHARS = 4000;

/** Checks the browser's chat history: plain text turns, alternating, ending with the user. */
export function parseChat(body: unknown): Anthropic.Beta.BetaMessageParam[] | string {
  const raw = (body as { messages?: unknown } | null)?.messages;
  if (!Array.isArray(raw) || raw.length === 0) return "Send a non-empty messages list.";
  if (raw.length > MAX_MESSAGES) return `At most ${MAX_MESSAGES} messages.`;
  const messages: Anthropic.Beta.BetaMessageParam[] = [];
  for (const [i, m] of raw.entries()) {
    const { role, content } = (m ?? {}) as { role?: unknown; content?: unknown };
    const expected = i % 2 === 0 ? "user" : "assistant";
    if (role !== expected) return "Messages must alternate, starting with the user.";
    if (typeof content !== "string" || content.trim() === "") return "Each message needs text.";
    if (content.length > MAX_MESSAGE_CHARS) return `Messages are limited to ${MAX_MESSAGE_CHARS} characters.`;
    messages.push({ role: expected, content });
  }
  if (messages.at(-1)?.role !== "user") return "The last message must be from the user.";
  return messages;
}
