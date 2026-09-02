import { Pool } from "pg";

/**
 * Postgres access layer. When DATABASE_URL is set (e.g. Neon Postgres connected
 * via the Vercel Marketplace integration), all community data — votes, flags,
 * digest subscribers, bookmarks, profiles, and auth — persists in Postgres.
 *
 * When DATABASE_URL is absent (local dev, preview builds without a DB), the
 * app degrades gracefully to the file-backed JSON store in serverStore.ts, so
 * nothing ever hard-crashes and dev keeps working out of the box.
 */

let pool: Pool | null = null;

export function getPool(): Pool {
  if (!pool) {
    // Pool construction is lazy — it only connects when a query runs — so it's
    // safe to build even when DATABASE_URL is missing. Callers should check
    // `dbEnabled` first and degrade gracefully instead of issuing queries.
    pool = new Pool({
      connectionString: process.env.DATABASE_URL ?? "",
      max: 5, // serverless-friendly pool size
    });
    // Never let an idle-client error crash the serverless process.
    pool.on("error", (err) => console.error("pg pool error:", err.message));
  }
  return pool;
}

export const dbEnabled = !!process.env.DATABASE_URL;

/** Run a query against Postgres. Returns the result rows. Throws if the DB is not configured. */
export async function query<T extends Record<string, unknown>>(
  text: string,
  params?: unknown[]
): Promise<T[]> {
  const result = await getPool().query(text, params);
  return result.rows as T[];
}
