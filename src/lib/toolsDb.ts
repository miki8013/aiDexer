import { aiDatabase, type AIModel } from "../app/api/recommend/aiDatabase";
import { dbEnabled, query } from "./db";

export type { AIModel };

/**
 * DB-backed access to the AI tools directory.
 *
 * The `tools` table in Postgres (seeded via `npm run db:seed`) is the single
 * source of truth. When DATABASE_URL is set and the table has rows, reads come
 * from Postgres; otherwise we fall back to the static aiDatabase so local dev
 * and preview builds without a DB keep working.
 */

type ToolRow = {
  slug: string;
  name: string;
  category: string;
  strengths: string[];
  best_for: string[];
  pricing: string;
  access: string;
  description: string;
  url: string;
  [key: string]: unknown;
};

function rowToModel(r: ToolRow): AIModel {
  return {
    name: r.name,
    category: r.category,
    strengths: r.strengths ?? [],
    bestFor: r.best_for ?? [],
    pricing: r.pricing,
    access: r.access,
    description: r.description,
    url: r.url,
  };
}

/** All tools, DB-first with static fallback. */
export async function getAllTools(): Promise<AIModel[]> {
  if (dbEnabled) {
    try {
      const rows = await query<ToolRow>("SELECT * FROM tools ORDER BY name");
      if (rows.length > 0) return rows.map(rowToModel);
    } catch (err) {
      console.error("getAllTools db error:", err);
    }
  }
  return aiDatabase;
}

/** Look up one tool by exact name, DB-first with static fallback. */
export async function getToolByName(name: string): Promise<AIModel | undefined> {
  if (dbEnabled) {
    try {
      const rows = await query<ToolRow>("SELECT * FROM tools WHERE name = $1", [name]);
      if (rows.length > 0) return rowToModel(rows[0]);
    } catch (err) {
      console.error("getToolByName db error:", err);
    }
  }
  return aiDatabase.find((t) => t.name === name);
}