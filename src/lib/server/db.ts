// Database access (server only). Production talks to Neon over HTTP; local development and
// tests use PGlite, an in-process Postgres, so neither needs a database server.
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { neon } from "@neondatabase/serverless";

/** The little the app needs from Postgres: parameterized queries returning rows. */
export interface Db {
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]>;
}

/** Schema statements, each idempotent, run once per process before first use. */
const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS items (
     key text PRIMARY KEY,
     schedule jsonb NOT NULL,
     last_review timestamptz
   )`,
  `CREATE TABLE IF NOT EXISTS reviews (
     id text PRIMARY KEY,
     card_key text NOT NULL,
     rating smallint NOT NULL,
     at timestamptz NOT NULL
   )`,
  `CREATE INDEX IF NOT EXISTS reviews_at ON reviews (at)`,
  `CREATE TABLE IF NOT EXISTS mistakes (id text PRIMARY KEY, data jsonb NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS stories (id text PRIMARY KEY, data jsonb NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS read_stories (id text PRIMARY KEY)`,
  `CREATE TABLE IF NOT EXISTS settings (id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1), data jsonb NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS failed_logins (at timestamptz NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS guest_spend (
     guest_id text PRIMARY KEY,
     spent_usd double precision NOT NULL DEFAULT 0,
     updated_at timestamptz NOT NULL
   )`,
];

export async function migrate(db: Db): Promise<void> {
  for (const statement of SCHEMA) await db.query(statement);
}

function neonDb(url: string): Db {
  const sql = neon(url);
  return { query: async <T,>(text: string, params: unknown[] = []) => (await sql.query(text, params)) as T[] };
}

/** A PGlite database in `dataDir`, or in memory when omitted (tests). */
export async function pgliteDb(dataDir?: string): Promise<Db> {
  const { PGlite } = await import("@electric-sql/pglite");
  // PGlite creates its own folder but not missing parents.
  if (dataDir) await mkdir(path.dirname(path.resolve(dataDir)), { recursive: true });
  const pg = new PGlite(dataDir);
  return { query: async <T,>(text: string, params: unknown[] = []) => (await pg.query<T>(text, params)).rows };
}

let instance: Promise<Db> | undefined;

/**
 * The app's database, migrated. Uses DATABASE_URL (Neon) when set; otherwise a local
 * PGlite database in PGLITE_DIR (default web/.data/pglite). Production without
 * DATABASE_URL fails loudly unless PGLITE_DIR is set explicitly (local production tests).
 */
export function getDb(): Promise<Db> {
  instance ??= (async () => {
    const url = process.env.DATABASE_URL;
    const pgliteDir = process.env.PGLITE_DIR;
    if (!url && !pgliteDir && process.env.NODE_ENV === "production") {
      throw new Error("DATABASE_URL is not set; production needs the Neon connection string");
    }
    const db = url ? neonDb(url) : await pgliteDb(pgliteDir ?? ".data/pglite");
    await migrate(db);
    return db;
  })();
  instance.catch(() => (instance = undefined)); // let the next request retry after a failure
  return instance;
}
