import { sql } from "drizzle-orm";
import type { AgentAnchor, AgentDimension } from "../agent/types";
import type { ShippingAddress } from "../orders/address";
import type { QuoteLine } from "../quotes/engine";
import { boolean, integer, jsonb, pgTable, primaryKey, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";

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

/**
 * An order is traceable to the exact frozen design version, quote and safety confirmation (plan rule 4).
 * The quote and spec are copied so later edits or expiry cannot change what was bought.
 * Status moves are defined in lib/orders/status.ts.
 */
export const orders = pgTable("orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerId: text("owner_id").notNull(),
  designId: uuid("design_id")
    .notNull()
    .references(() => designs.id),
  version: integer("version").notNull(),
  quoteId: uuid("quote_id").references(() => quotes.id),
  status: text("status").notNull().default("quote"),
  quoteSnapshot: jsonb("quote_snapshot").$type<QuoteLine>().notNull(),
  specSnapshot: jsonb("spec_snapshot").$type<Record<string, unknown>>().notNull(),
  shippingAddress: jsonb("shipping_address").$type<ShippingAddress>().notNull(),
  totalCents: integer("total_cents").notNull(),
  safetyConfirmedAt: timestamp("safety_confirmed_at", { withTimezone: true }).notNull(),
  termsAcceptedAt: timestamp("terms_accepted_at", { withTimezone: true }).notNull(),
  paymentProvider: text("payment_provider"),
  paymentRef: text("payment_ref"),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  partnerOrderRef: text("partner_order_ref"),
  trackingNumber: text("tracking_number"),
  contactEmail: text("contact_email"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().default(sql`now()`),
});

/** A seller's store. Unpublished until Stripe verifies the seller (B4.1). One store per user for now. */
export const stores = pgTable("stores", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerId: text("owner_id").notNull().unique(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  published: boolean("published").notNull().default(false),
  stripeConnectAccount: text("stripe_connect_account"),
  connectVerified: boolean("connect_verified").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
});

/** A design version offered for sale. Prices are frozen at listing time; review_status is pending, approved or rejected (B4.4). */
export const listings = pgTable("listings", {
  id: uuid("id").primaryKey().defaultRandom(),
  storeId: uuid("store_id")
    .notNull()
    .references(() => stores.id, { onDelete: "cascade" }),
  designId: uuid("design_id")
    .notNull()
    .references(() => designs.id),
  version: integer("version").notNull(),
  title: text("title").notNull(),
  materialId: text("material_id").notNull(),
  materialName: text("material_name").notNull(),
  retailCents: integer("retail_cents").notNull(),
  floorCents: integer("floor_cents").notNull(),
  platformFeeCents: integer("platform_fee_cents").notNull(),
  royaltyCents: integer("royalty_cents").notNull(),
  placeholder: boolean("placeholder").notNull().default(true),
  reviewStatus: text("review_status").notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
});
/** A user's plan. No row means the free plan. Stripe ids are filled in when Stripe Billing is connected. */
export const subscriptions = pgTable("subscriptions", {
  ownerId: text("owner_id").primaryKey(),
  plan: text("plan").notNull().default("free"),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().default(sql`now()`),
});

/** AI messages a user has sent in a calendar month ("2026-10"). */
export const usageCounters = pgTable(
  "usage_counters",
  {
    ownerId: text("owner_id").notNull(),
    period: text("period").notNull(),
    aiMessages: integer("ai_messages").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.ownerId, t.period] })],
);

/** Every safety decision, automatic or by an admin, so each can be traced (plan B2.4). */
export const safetyReviews = pgTable("safety_reviews", {
  id: uuid("id").primaryKey().defaultRandom(),
  designId: uuid("design_id")
    .notNull()
    .references(() => designs.id, { onDelete: "cascade" }),
  /** request (the user's message), spec, or admin. */
  source: text("source").notNull(),
  status: text("status").notNull(),
  category: text("category").notNull(),
  reason: text("reason").notNull(),
  model: text("model"),
  decidedBy: text("decided_by"),
  /** approved or rejected, set when an admin decides. */
  decision: text("decision"),
  decidedAt: timestamp("decided_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
});

/** The one saved set of partner rates and markup (row id 1). Editing it in the admin console replaces the placeholder numbers in code. */
export const rateCards = pgTable("rate_cards", {
  id: integer("id").primaryKey(),
  config: jsonb("config").$type<import("../quotes/rates-config").RatesConfig>().notNull(),
  updatedBy: text("updated_by"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().default(sql`now()`),
});

/** One row per email sent for an order event, so each event is emailed once even if a webhook repeats. */
export const emailLog = pgTable(
  "email_log",
  {
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    event: text("event").notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }).notNull().default(sql`now()`),
  },
  (t) => [primaryKey({ columns: [t.orderId, t.event] })],
);

/** People who asked to be told when ordering opens. Lower-cased email is the key, so signing up twice does nothing. */
export const waitlist = pgTable("waitlist", {
  email: text("email").primaryKey(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
});

/** Fixed-window counters for rate limits: one row per key and window, so concurrent requests all count. */
export const rateLimits = pgTable(
  "rate_limits",
  {
    key: text("key").notNull(),
    windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
    hits: integer("hits").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.key, t.windowStart] })],
);

/**
 * What we owe a seller, as signed cents: royalties add, refunds and payouts subtract. Append-only; one row
 * per (store, kind, ref), so recording the same sale, refund or payout twice changes nothing.
 */
export const ledgerEntries = pgTable(
  "ledger_entries",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    storeId: uuid("store_id")
      .notNull()
      .references(() => stores.id),
    listingId: uuid("listing_id").references(() => listings.id),
    kind: text("kind").notNull(),
    ref: text("ref").notNull(),
    amountCents: integer("amount_cents").notNull(),
    placeholder: boolean("placeholder").notNull().default(true),
    note: text("note"),
    createdBy: text("created_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
  },
  (t) => [unique("ledger_entries_unique").on(t.storeId, t.kind, t.ref)],
);
