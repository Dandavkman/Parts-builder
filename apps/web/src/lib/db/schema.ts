import { sql } from "drizzle-orm";
import type { AgentAnchor, AgentDimension } from "../agent/types";
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
    /** Anchors the spec was built against, copied so later anchor edits cannot change an old version. */
    anchors: jsonb("anchors").$type<AgentAnchor[]>().notNull().default(sql`'[]'::jsonb`),
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

/**
 * Where a design's anchors and dimensions came from: a photo, a lookup, a scan, or numbers the user
 * typed. A design with no references uses the stand-in fixture panel until real scans exist.
 */
export const designReferences = pgTable("design_references", {
  id: uuid("id").primaryKey().defaultRandom(),
  designId: uuid("design_id")
    .notNull()
    .references(() => designs.id, { onDelete: "cascade" }),
  /** photo, researched, scan or stated. */
  kind: text("kind").notNull(),
  label: text("label").notNull(),
  anchors: jsonb("anchors").$type<AgentAnchor[]>().notNull().default(sql`'[]'::jsonb`),
  dimensions: jsonb("dimensions").$type<AgentDimension[]>().notNull().default(sql`'[]'::jsonb`),
  /** A photo kept here until file storage exists (decision D4): shrunk in the browser, base64, under 900 KB. */
  imageMediaType: text("image_media_type"),
  imageBase64: text("image_base64"),
  /** Plain words on how accurate this is, shown in the workspace. */
  accuracyNote: text("accuracy_note"),
  /** Set when the user confirmed the values. Unconfirmed references are not given to the agent. */
  confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
});

/** One quote per partner and material for a frozen design version (decision D2). Money is US cents; every component is kept so margin is visible. */
export const quotes = pgTable("quotes", {
  id: uuid("id").primaryKey().defaultRandom(),
  designId: uuid("design_id")
    .notNull()
    .references(() => designs.id, { onDelete: "cascade" }),
  version: integer("version").notNull(),
  partnerId: text("partner_id").notNull(),
  partnerName: text("partner_name").notNull(),
  materialId: text("material_id").notNull(),
  materialName: text("material_name").notNull(),
  quantity: integer("quantity").notNull(),
  partnerPartsCents: integer("partner_parts_cents").notNull(),
  setupFeeCents: integer("setup_fee_cents").notNull(),
  partnerCostCents: integer("partner_cost_cents").notNull(),
  markupCents: integer("markup_cents").notNull(),
  shippingCents: integer("shipping_cents").notNull(),
  paymentFeeCents: integer("payment_fee_cents").notNull(),
  totalCents: integer("total_cents").notNull(),
  leadDays: integer("lead_days").notNull(),
  /** True while the rate cards are stand-ins (see rate-cards.ts). */
  placeholder: boolean("placeholder").notNull().default(true),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
});
