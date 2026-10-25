import { neon } from "@neondatabase/serverless";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-http";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { migrate, type SqlRunner } from "./migrations";
import * as schema from "./schema";

export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

export class DatabaseNotConfigured extends Error {}

export function runnerFor(db: Db): SqlRunner {
  return {
    run: (statement) => db.execute(sql.raw(statement)),
    appliedIds: async () => {
      const result = (await db.execute(sql`SELECT id FROM _migrations`)) as unknown as
        | { rows: { id: string }[] }
        | { id: string }[];
      return (Array.isArray(result) ? result : result.rows).map((r) => r.id);
    },
  };
}

let cached: Promise<Db> | undefined;

/** The shared database, created on first use. Reads DATABASE_URL at request time, never at build time. */
export function getDb(env: Record<string, string | undefined> = process.env): Promise<Db> {
  cached ??= (async () => {
    const url = env.DATABASE_URL;
    if (!url) throw new DatabaseNotConfigured("DATABASE_URL is not set");
    const db = drizzle(neon(url), { schema }) as unknown as Db;
    await migrate(runnerFor(db));
    return db;
  })().catch((error) => {
    cached = undefined;
    throw error;
  });
  return cached;
}
