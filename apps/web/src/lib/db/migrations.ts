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
