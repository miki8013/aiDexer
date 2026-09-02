/**
 * Applies db/schema.sql to the Postgres database in DATABASE_URL.
 *
 * Usage (no secrets stored locally — pass the connection string inline):
 *   PowerShell:  $env:DATABASE_URL="postgres://..."; npm run db:migrate
 *   Or on Vercel (where the var is already set): vercel env ... / a one-off job.
 *
 * Idempotent: uses CREATE TABLE IF NOT EXISTS, so it can be re-run safely.
 */
import fs from "node:fs";
import path from "node:path";
import { Client } from "pg";

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("DATABASE_URL is not set. e.g. $env:DATABASE_URL=\"postgres://...\"; npm run db:migrate");
    process.exit(1);
  }

  const schemaPath = path.join(process.cwd(), "db", "schema.sql");
  const sql = fs.readFileSync(schemaPath, "utf8");

  const client = new Client({
    connectionString,
    ssl: connectionString.includes("localhost") ? undefined : { rejectUnauthorized: false },
  });
  try {
    await client.connect();
    await client.query(sql);
    console.log("✅ Schema applied: votes, flags, subscribers, bookmarks, profiles + better-auth tables");
  } catch (err) {
    console.error("❌ Migration failed:", err.message);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main();
