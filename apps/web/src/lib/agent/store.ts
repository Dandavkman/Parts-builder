import type Anthropic from "@anthropic-ai/sdk";
import { and, asc, desc, eq, isNotNull, sql } from "drizzle-orm";
import type { Db } from "../db/client";
import { chatMessages, designReferences, designs, designVersions } from "../db/schema";
import { FIXTURE_ANCHORS } from "./fixture-anchors";
import type { Recorder } from "./loop";
import type { AgentImage, ImageMediaType } from "./request";
import type { AgentAnchor, AgentDimension, DesignReferences, ReferenceKind } from "./types";

type MessageParam = Anthropic.Beta.BetaMessageParam;

export async function createDesign(db: Db, ownerId: string, title: string): Promise<string> {
  const [row] = await db.insert(designs).values({ ownerId, title: title.slice(0, 80) }).returning({ id: designs.id });
  return row.id;
}

/** The design, only if `ownerId` owns it. */
export async function getOwnedDesign(db: Db, designId: string, ownerId: string) {
  const [row] = await db
    .select()
    .from(designs)
    .where(and(eq(designs.id, designId), eq(designs.ownerId, ownerId)));
  return row ?? null;
}

/** The owner's designs, newest first. */
export async function listOwnedDesigns(db: Db, ownerId: string) {
  return db
    .select({ id: designs.id, title: designs.title, currentVersion: designs.currentVersion, createdAt: designs.createdAt })
    .from(designs)
    .where(eq(designs.ownerId, ownerId))
    .orderBy(desc(designs.createdAt))
    .limit(50);
}

/** Every version of a design (including ones that failed to build), oldest first. */
export async function listVersions(db: Db, designId: string) {
  const rows = await db
    .select({
      version: designVersions.version,
      createdBy: designVersions.createdBy,
      buildOk: designVersions.buildOk,
      buildErrors: designVersions.buildErrors,
      createdAt: designVersions.createdAt,
      spec: designVersions.spec,
    })
    .from(designVersions)
    .where(eq(designVersions.designId, designId))
    .orderBy(asc(designVersions.version));
  return rows.map(({ spec, ...row }) => ({ ...row, name: typeof spec.name === "string" ? spec.name : "" }));
}

/**
 * Makes an earlier version that built the current one (undo). Nothing is deleted, so a later
 * version can be made current again. Versions that failed to build cannot be current.
 */
export async function setCurrentVersion(
  db: Db,
  designId: string,
  ownerId: string,
  version: number,
): Promise<"ok" | "not_found" | "not_built"> {
  const row = await getOwnedVersion(db, designId, ownerId, version);
  if (!row) return "not_found";
  if (!row.buildOk) return "not_built";
  await db.update(designs).set({ currentVersion: version }).where(eq(designs.id, designId));
  return "ok";
}

export async function loadHistory(db: Db, designId: string): Promise<MessageParam[]> {
  const rows = await db
    .select({ role: chatMessages.role, content: chatMessages.content })
    .from(chatMessages)
    .where(eq(chatMessages.designId, designId))
    .orderBy(asc(chatMessages.seq));
  return rows.map((r) => ({ role: r.role, content: r.content }) as MessageParam);
}

/** Saves every message (with token counts) and every spec version for one design. */
export function recorderFor(db: Db, designId: string): Recorder {
  return {
    async message({ role, content, model, usage }) {
      await db.insert(chatMessages).values({
        designId,
        role,
        content,
        model: model ?? null,
        inputTokens: usage?.input_tokens ?? 0,
        outputTokens: usage?.output_tokens ?? 0,
        cacheCreationInputTokens: usage?.cache_creation_input_tokens ?? 0,
        cacheReadInputTokens: usage?.cache_read_input_tokens ?? 0,
        seq: sql`(SELECT coalesce(max(seq), 0) + 1 FROM chat_messages WHERE design_id = ${designId})`,
      });
    },
    async version({ spec, anchors, ok, errors, createdBy }) {
      const [row] = await db
        .insert(designVersions)
        .values({
          designId,
          spec,
          specSchemaVersion: String(spec.spec_version ?? "unknown"),
          anchors,
          createdBy,
          buildOk: ok,
          buildErrors: errors,
          version: sql`(SELECT coalesce(max(version), 0) + 1 FROM design_versions WHERE design_id = ${designId})`,
        })
        .returning({ version: designVersions.version });
      if (ok) await db.update(designs).set({ currentVersion: row.version }).where(eq(designs.id, designId));
    },
  };
}

/** A saved version of a design the user owns: a number, or "current" for the latest that built. */
export async function getOwnedVersion(db: Db, designId: string, ownerId: string, which: number | "current") {
  const design = await getOwnedDesign(db, designId, ownerId);
  if (!design) return null;
  const number = which === "current" ? design.currentVersion : which;
  if (number === null) return null;
  const [row] = await db
    .select()
    .from(designVersions)
    .where(and(eq(designVersions.designId, designId), eq(designVersions.version, number)));
  return row ?? null;
}

/**
 * Adds the user's new message to a stored conversation. If the agent left tool calls open
 * (it asked a question, or a request died mid-turn), the user's text answers `ask_user` and any
 * other open call is closed as skipped, because the API needs a result for every tool call.
 */
export function withUserMessage(history: MessageParam[], text: string): MessageParam[] {
  const last = history.at(-1);
  const open =
    last?.role === "assistant" && Array.isArray(last.content)
      ? last.content.filter((b): b is Anthropic.Beta.BetaToolUseBlockParam => b.type === "tool_use")
      : [];
  if (open.length === 0) return [...history, { role: "user", content: text }];
  const results: Anthropic.Beta.BetaToolResultBlockParam[] = open.map((call) =>
    call.name === "ask_user"
      ? { type: "tool_result", tool_use_id: call.id, content: text }
      : { type: "tool_result", tool_use_id: call.id, content: "Skipped: the request was interrupted.", is_error: true },
  );
  return [...history, { role: "user", content: results }];
}

/** Saves a reference for a design. Pass `confirmed: false` for values the user has not yet accepted. */
export async function addReference(
  db: Db,
  designId: string,
  ref: {
    kind: ReferenceKind;
    label: string;
    anchors?: AgentAnchor[];
    dimensions?: AgentDimension[];
    accuracyNote?: string;
    confirmed?: boolean;
  },
): Promise<string> {
  const [row] = await db
    .insert(designReferences)
    .values({
      designId,
      kind: ref.kind,
      label: ref.label.slice(0, 120),
      anchors: ref.anchors ?? [],
      dimensions: ref.dimensions ?? [],
      accuracyNote: ref.accuracyNote ?? null,
      confirmedAt: ref.confirmed === false ? null : new Date(),
    })
    .returning({ id: designReferences.id });
  return row.id;
}

/**
 * What the agent may use for a design: the anchors and dimensions of its confirmed references. A
 * design with none yet falls back to the fixture panel, the stand-in until scans exist (B1.5). The
 * first confirmed reference replaces the fixtures, so a photo-based design never sees the panel.
 */
export async function loadReferences(db: Db, designId: string): Promise<DesignReferences> {
  const rows = await db
    .select()
    .from(designReferences)
    .where(eq(designReferences.designId, designId))
    .orderBy(asc(designReferences.createdAt));
  const confirmed = rows.filter((r) => r.confirmedAt !== null);
  if (confirmed.length === 0) return { anchors: FIXTURE_ANCHORS, dimensions: [] };
  return {
    anchors: confirmed.flatMap((r) => r.anchors),
    dimensions: confirmed.flatMap((r) => r.dimensions),
  };
}

export const MAX_PHOTOS_PER_DESIGN = 4;

/** Keeps the user's photo with the design. Returns false when the design already has the most allowed. */
export async function addPhoto(db: Db, designId: string, photo: AgentImage): Promise<boolean> {
  const have = await db
    .select({ id: designReferences.id })
    .from(designReferences)
    .where(and(eq(designReferences.designId, designId), isNotNull(designReferences.imageBase64)));
  if (have.length >= MAX_PHOTOS_PER_DESIGN) return false;
  await db.insert(designReferences).values({
    designId,
    kind: "photo",
    label: "Photo",
    imageMediaType: photo.mediaType,
    imageBase64: photo.base64,
    accuracyNote: "Scale comes from a stated dimension or a reference object, not from the photo alone.",
    confirmedAt: new Date(),
  });
  return true;
}

export async function loadPhotos(db: Db, designId: string): Promise<AgentImage[]> {
  const rows = await db
    .select({ mediaType: designReferences.imageMediaType, base64: designReferences.imageBase64 })
    .from(designReferences)
    .where(and(eq(designReferences.designId, designId), isNotNull(designReferences.imageBase64)))
    .orderBy(asc(designReferences.createdAt));
  return rows.flatMap((r) => (r.mediaType && r.base64 ? [{ mediaType: r.mediaType as ImageMediaType, base64: r.base64 }] : []));
}

/**
 * Puts the design's photos at the top of the first user message, for this request only: they are not
 * saved in the conversation (the photo lives in `design_references`), so history stays small and every
 * turn sees the same photos in the same place.
 */
export function withPhotos(history: MessageParam[], photos: AgentImage[]): MessageParam[] {
  const first = history[0];
  if (photos.length === 0 || !first || first.role !== "user") return history;
  const blocks: Anthropic.Beta.BetaContentBlockParam[] = photos.map((p) => ({
    type: "image",
    source: { type: "base64", media_type: p.mediaType, data: p.base64 },
  }));
  const rest: Anthropic.Beta.BetaContentBlockParam[] =
    typeof first.content === "string" ? [{ type: "text", text: first.content }] : first.content;
  return [{ role: "user", content: [...blocks, ...rest] }, ...history.slice(1)];
}

const DIMENSIONS_LABEL = "Dimensions";

/** Records a named length for the design, replacing any earlier one with the same id. */
export async function saveDimension(db: Db, designId: string, dimension: AgentDimension): Promise<void> {
  const [row] = await db
    .select()
    .from(designReferences)
    .where(and(eq(designReferences.designId, designId), eq(designReferences.label, DIMENSIONS_LABEL)));
  if (!row) {
    await addReference(db, designId, { kind: "stated", label: DIMENSIONS_LABEL, dimensions: [dimension] });
    return;
  }
  const others = row.dimensions.filter((d) => d.id !== dimension.id);
  await db.update(designReferences).set({ dimensions: [...others, dimension] }).where(eq(designReferences.id, row.id));
}
