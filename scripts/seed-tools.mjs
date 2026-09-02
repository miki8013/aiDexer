/**
 * Seeds the `tools` table from src/app/api/recommend/aiDatabase.ts.
 * Idempotent — upserts by slug, so re-running updates changed rows only.
 *
 * Usage (no secrets stored locally — pass the connection string inline):
 *   PowerShell:  $env:DATABASE_URL="postgres://..."; npm run db:seed
 */
import fs from "node:fs";
import path from "node:path";
import { Client } from "pg";

function extractArray(source) {
  const open = source.indexOf("= [");
  if (open < 0) throw new Error("'= [' not found");
  const arrayStart = open + 2;
  const close = source.indexOf("];", arrayStart);
  if (close < 0) throw new Error("']' not found");
  const body = source.slice(arrayStart, close + 1);
  // eslint-disable-next-line no-eval
  return eval("(" + body + ")");
}

function slugify(name) {
  return name
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL is not set. e.g. $env:DATABASE_URL="postgres://..."; npm run db:seed');
    process.exit(1);
  }

  const dbPath = path.join(process.cwd(), "src", "app", "api", "recommend", "aiDatabase.ts");
  const tools = extractArray(fs.readFileSync(dbPath, "utf8"));

  const client = new Client({
    connectionString,
    ssl: connectionString.includes("localhost") ? undefined : { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    for (const t of tools) {
      await client.query(
        `INSERT INTO tools (slug, name, category, strengths, best_for, pricing, access, description, url)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         ON CONFLICT (slug) DO UPDATE SET
           name = EXCLUDED.name,
           category = EXCLUDED.category,
           strengths = EXCLUDED.strengths,
           best_for = EXCLUDED.best_for,
           pricing = EXCLUDED.pricing,
           access = EXCLUDED.access,
           description = EXCLUDED.description,
           url = EXCLUDED.url`,
        [
          slugify(t.name),
          t.name,
          t.category,
          t.strengths,
          t.bestFor,
          t.pricing,
          t.access,
          t.description,
          t.url,
        ]
      );
    }
    const { rows } = await client.query("SELECT COUNT(*)::int AS n FROM tools");
    console.log(`✅ Seeded ${tools.length} tools (${rows[0].n} total in tools table)`);
  } catch (err) {
    console.error("❌ Seed failed:", err.message);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main();