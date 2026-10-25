import type Anthropic from "@anthropic-ai/sdk";
import { and, asc, eq, sql } from "drizzle-orm";
import type { Db } from "../db/client";
import { chatMessages, designs, designVersions } from "../db/schema";
import type { Recorder } from "./loop";

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
