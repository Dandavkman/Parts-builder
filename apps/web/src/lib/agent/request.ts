export const MAX_MESSAGE_CHARS = 4000;

export interface AgentRequest {
  designId: string | null;
  message: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Checks the browser's request: one new message, and the design it continues (if any). */
export function parseRequest(body: unknown): AgentRequest | string {
  const { design_id, message } = (body ?? {}) as { design_id?: unknown; message?: unknown };
  if (typeof message !== "string" || message.trim() === "") return "Send a message.";
  if (message.length > MAX_MESSAGE_CHARS) return `Messages are limited to ${MAX_MESSAGE_CHARS} characters.`;
  if (design_id !== undefined && design_id !== null && (typeof design_id !== "string" || !UUID.test(design_id))) {
    return "design_id must be a design id.";
  }
  return { designId: (design_id as string | null | undefined) ?? null, message };
}
