/**
 * Numbered, additive migrations, kept as strings so they ship inside the server bundle.
 * Add new ones to the end; never edit one that has been applied. Statements are idempotent.
 */
export const MIGRATIONS: { id: string; sql: string[] }[] = [
  {
    id: "0001_designs_versions_messages",
    sql: [
      `CREATE TABLE IF NOT EXISTS designs (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        owner_id text NOT NULL,
        title text NOT NULL,
        safety_status text NOT NULL DEFAULT 'allowed',
        scan_id text,
        current_version integer,
        created_at timestamptz NOT NULL DEFAULT now()
      )`,
      `CREATE TABLE IF NOT EXISTS design_versions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        design_id uuid NOT NULL REFERENCES designs(id) ON DELETE CASCADE,
        version integer NOT NULL,
        spec jsonb NOT NULL,
        spec_schema_version text NOT NULL,
        created_by text NOT NULL,
        build_ok boolean NOT NULL,
        build_errors jsonb NOT NULL DEFAULT '[]'::jsonb,
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT design_versions_design_version UNIQUE (design_id, version)
      )`,
      `CREATE TABLE IF NOT EXISTS chat_messages (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        design_id uuid NOT NULL REFERENCES designs(id) ON DELETE CASCADE,
        seq integer NOT NULL,
        role text NOT NULL,
        content jsonb NOT NULL,
        model text,
        input_tokens integer NOT NULL DEFAULT 0,
        output_tokens integer NOT NULL DEFAULT 0,
        cache_creation_input_tokens integer NOT NULL DEFAULT 0,
        cache_read_input_tokens integer NOT NULL DEFAULT 0,
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT chat_messages_design_seq UNIQUE (design_id, seq)
      )`,
      `CREATE INDEX IF NOT EXISTS designs_owner_idx ON designs (owner_id)`,
    ],
  },
  {
    id: "0002_version_anchors",
    sql: [`ALTER TABLE design_versions ADD COLUMN IF NOT EXISTS anchors jsonb NOT NULL DEFAULT '[]'::jsonb`],
  },
  {
    id: "0003_design_references",
    sql: [
      `CREATE TABLE IF NOT EXISTS design_references (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        design_id uuid NOT NULL REFERENCES designs(id) ON DELETE CASCADE,
        kind text NOT NULL,
        label text NOT NULL,
        anchors jsonb NOT NULL DEFAULT '[]'::jsonb,
        dimensions jsonb NOT NULL DEFAULT '[]'::jsonb,
        accuracy_note text,
        confirmed_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now()
      )`,
      `CREATE INDEX IF NOT EXISTS design_references_design_idx ON design_references (design_id)`,
    ],
  },
  {
    id: "0004_reference_photo",
    sql: [
      `ALTER TABLE design_references ADD COLUMN IF NOT EXISTS image_media_type text`,
      `ALTER TABLE design_references ADD COLUMN IF NOT EXISTS image_base64 text`,
    ],
  },
  {
    id: "0005_quotes",
    sql: [
      `CREATE TABLE IF NOT EXISTS quotes (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        design_id uuid NOT NULL REFERENCES designs(id) ON DELETE CASCADE,
        version integer NOT NULL,
        partner_id text NOT NULL,
        partner_name text NOT NULL,
        material_id text NOT NULL,
        material_name text NOT NULL,
        quantity integer NOT NULL,
        partner_parts_cents integer NOT NULL,
        setup_fee_cents integer NOT NULL,
        partner_cost_cents integer NOT NULL,
        markup_cents integer NOT NULL,
        shipping_cents integer NOT NULL,
        payment_fee_cents integer NOT NULL,
        total_cents integer NOT NULL,
        lead_days integer NOT NULL,
        placeholder boolean NOT NULL DEFAULT true,
        expires_at timestamptz NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      )`,
      `CREATE INDEX IF NOT EXISTS quotes_design_idx ON quotes (design_id, version)`,
    ],
  },
  {
    id: "0006_orders",
    sql: [
      `CREATE TABLE IF NOT EXISTS orders (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        owner_id text NOT NULL,
        design_id uuid NOT NULL REFERENCES designs(id),
        version integer NOT NULL,
        quote_id uuid REFERENCES quotes(id),
        status text NOT NULL DEFAULT 'quote',
        quote_snapshot jsonb NOT NULL,
        spec_snapshot jsonb NOT NULL,
        shipping_address jsonb NOT NULL,
        total_cents integer NOT NULL,
        safety_confirmed_at timestamptz NOT NULL,
        terms_accepted_at timestamptz NOT NULL,
        payment_provider text,
        payment_ref text,
        paid_at timestamptz,
        partner_order_ref text,
        tracking_number text,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`,
      `CREATE INDEX IF NOT EXISTS orders_owner_idx ON orders (owner_id)`,
      `CREATE INDEX IF NOT EXISTS orders_status_idx ON orders (status)`,
      `CREATE UNIQUE INDEX IF NOT EXISTS orders_payment_ref_idx ON orders (payment_provider, payment_ref) WHERE payment_ref IS NOT NULL`,
    ],
  },
  {
    id: "0007_plans_usage",
    sql: [
      `CREATE TABLE IF NOT EXISTS subscriptions (
        owner_id text PRIMARY KEY,
        plan text NOT NULL DEFAULT 'free',
        stripe_customer_id text,
        stripe_subscription_id text,
        updated_at timestamptz NOT NULL DEFAULT now()
      )`,
      `CREATE TABLE IF NOT EXISTS usage_counters (
        owner_id text NOT NULL,
        period text NOT NULL,
        ai_messages integer NOT NULL DEFAULT 0,
        PRIMARY KEY (owner_id, period)
      )`,
    ],
  },
  {
    id: "0008_stores_listings",
    sql: [
      `CREATE TABLE IF NOT EXISTS stores (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        owner_id text NOT NULL UNIQUE,
        slug text NOT NULL UNIQUE,
        name text NOT NULL,
        published boolean NOT NULL DEFAULT false,
        stripe_connect_account text,
        created_at timestamptz NOT NULL DEFAULT now()
      )`,
      `CREATE TABLE IF NOT EXISTS listings (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        store_id uuid NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
        design_id uuid NOT NULL REFERENCES designs(id),
        version integer NOT NULL,
        title text NOT NULL,
        material_id text NOT NULL,
        material_name text NOT NULL,
        retail_cents integer NOT NULL,
        floor_cents integer NOT NULL,
        platform_fee_cents integer NOT NULL,
        royalty_cents integer NOT NULL,
        placeholder boolean NOT NULL DEFAULT true,
        review_status text NOT NULL DEFAULT 'pending',
        created_at timestamptz NOT NULL DEFAULT now()
      )`,
      `CREATE INDEX IF NOT EXISTS listings_store_idx ON listings (store_id)`,
    ],
  },
  {
    id: "0009_safety_reviews",
    sql: [
      `CREATE TABLE IF NOT EXISTS safety_reviews (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        design_id uuid NOT NULL REFERENCES designs(id) ON DELETE CASCADE,
        source text NOT NULL,
        status text NOT NULL,
        category text NOT NULL,
        reason text NOT NULL,
        model text,
        decided_by text,
        decision text,
        decided_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now()
      )`,
      `CREATE INDEX IF NOT EXISTS safety_reviews_design_idx ON safety_reviews (design_id)`,
    ],
  },
  {
    id: "0010_rate_cards",
    sql: [
      `CREATE TABLE IF NOT EXISTS rate_cards (
        id integer PRIMARY KEY CHECK (id = 1),
        config jsonb NOT NULL,
        updated_by text,
        updated_at timestamptz NOT NULL DEFAULT now()
      )`,
    ],
  },
  {
    id: "0011_order_emails",
    sql: [
      `ALTER TABLE orders ADD COLUMN IF NOT EXISTS contact_email text`,
      `CREATE TABLE IF NOT EXISTS email_log (
        order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        event text NOT NULL,
        sent_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (order_id, event)
      )`,
    ],
  },
];

/** Minimal database surface the runner needs; both the Neon and PGlite drivers fit it via drizzle. */
export interface SqlRunner {
  run(statement: string): Promise<unknown>;
  appliedIds(): Promise<string[]>;
}

export async function migrate(db: SqlRunner): Promise<string[]> {
  await db.run(`CREATE TABLE IF NOT EXISTS _migrations (id text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`);
  const done = new Set(await db.appliedIds());
  const applied: string[] = [];
  for (const m of MIGRATIONS) {
    if (done.has(m.id)) continue;
    for (const statement of m.sql) await db.run(statement);
    await db.run(`INSERT INTO _migrations (id) VALUES ('${m.id}') ON CONFLICT DO NOTHING`);
    applied.push(m.id);
  }
  return applied;
}
