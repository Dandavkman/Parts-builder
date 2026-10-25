import { sql } from "drizzle-orm";
import { boolean, integer, jsonb, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";

/** Owner is the Clerk user id (or "dev" in the local bypass). A users table arrives with plans in Phase 2. */
export const designs = pgTable("designs", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerId: text("owner_id").notNull(),
  title: text("title").notNull(),
  /** allowed, needs_review or blocked. Set by the safety guard (B2.4); everything is allowed until then. */
  safetyStatus: text("safety_status").notNull().default("allowed"),
  scanId: text("scan_id"),
  /** Number of the latest version that built. Null until one does. */
  currentVersion: integer("current_version"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
});

/** Every spec the agent, a slider or the user produced, including ones that failed to build. */
export const designVersions = pgTable(
  "design_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    designId: uuid("design_id")
      .notNull()
      .references(() => designs.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    spec: jsonb("spec").$type<Record<string, unknown>>().notNull(),
    specSchemaVersion: text("spec_schema_version").notNull(),
    createdBy: text("created_by").notNull(),
    buildOk: boolean("build_ok").notNull(),
    buildErrors: jsonb("build_errors").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
  },
  (t) => [unique("design_versions_design_version").on(t.designId, t.version)],
);

/** One row per model message, with the exact content blocks so a conversation can be replayed. */
export const chatMessages = pgTable(
  "chat_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    designId: uuid("design_id")
      .notNull()
      .references(() => designs.id, { onDelete: "cascade" }),
    seq: integer("seq").notNull(),
    role: text("role").notNull(),
    content: jsonb("content").$type<unknown>().notNull(),
    model: text("model"),
    inputTokens: integer("input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    cacheCreationInputTokens: integer("cache_creation_input_tokens").notNull().default(0),
    cacheReadInputTokens: integer("cache_read_input_tokens").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
  },
  (t) => [unique("chat_messages_design_seq").on(t.designId, t.seq)],
);
