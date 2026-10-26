export const MAX_MESSAGE_CHARS = 4000;
/** The browser shrinks photos to about 300 KB; this leaves room and keeps rows small (decision D4). */
export const MAX_IMAGE_BASE64_CHARS = 900_000;
export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export type ImageMediaType = (typeof IMAGE_TYPES)[number];

export interface AgentImage {
  mediaType: ImageMediaType;
  base64: string;
}

export interface AgentRequest {
  designId: string | null;
  message: string;
  image: AgentImage | null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;

function parseImage(image: unknown): AgentImage | string | null {
  if (image === undefined || image === null) return null;
  const { media_type, data } = image as { media_type?: unknown; data?: unknown };
  if (typeof media_type !== "string" || !(IMAGE_TYPES as readonly string[]).includes(media_type)) {
    return "The photo must be a JPEG, PNG or WebP image.";
  }
  if (typeof data !== "string" || data === "" || !BASE64.test(data)) return "The photo data is not valid.";
  if (data.length > MAX_IMAGE_BASE64_CHARS) return "The photo is too large. Try a smaller one.";
  return { mediaType: media_type as ImageMediaType, base64: data };
}

/** Checks the browser's request: one new message, an optional photo, and the design it continues (if any). */
export function parseRequest(body: unknown): AgentRequest | string {
  const { design_id, message, image } = (body ?? {}) as { design_id?: unknown; message?: unknown; image?: unknown };
  if (typeof message !== "string" || message.trim() === "") return "Send a message.";
  if (message.length > MAX_MESSAGE_CHARS) return `Messages are limited to ${MAX_MESSAGE_CHARS} characters.`;
  if (design_id !== undefined && design_id !== null && (typeof design_id !== "string" || !UUID.test(design_id))) {
    return "design_id must be a design id.";
  }
  const photo = parseImage(image);
  if (typeof photo === "string") return photo;
  return { designId: (design_id as string | null | undefined) ?? null, message, image: photo };
}
