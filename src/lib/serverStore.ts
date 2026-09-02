import fs from "node:fs/promises";
import path from "node:path";
import { dbEnabled, query } from "./db";

/**
 * Community data store: votes, flags, digest subscribers.
 *
 * Postgres-first (Neon via Vercel) so data survives serverless cold starts and
 * deploys. If DATABASE_URL is not configured, falls back to the legacy
 * file-backed JSON store in `.data/` so local dev keeps working. All operations
 * degrade gracefully — a failed write never breaks a user-facing request.
 */

const DATA_DIR = process.env.AIDEXER_DATA_DIR ?? path.join(process.cwd(), ".data");

/**
 * File-backed fallback — ONLY used when DATABASE_URL is absent (local dev
 * without a database). When Postgres is configured these are never called, so
 * the serverless read-only filesystem is never touched in production.
 */
async function readJson<T>(file: string, fallback: T): Promise<T> {
  if (dbEnabled) return fallback;
  try {
    const raw = await fs.readFile(path.join(DATA_DIR, file), "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function writeJson(file: string, data: unknown): Promise<boolean> {
  if (dbEnabled) return false;
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(path.join(DATA_DIR, file), JSON.stringify(data, null, 2), "utf8");
    return true;
  } catch (err) {
    console.error(`Failed to persist ${file}:`, err);
    return false;
  }
}

export type VoteCounts = Record<string, number>;

export async function getVotes(): Promise<VoteCounts> {
  if (dbEnabled) {
    try {
      const rows = await query<{ tool: string; count: string }>(
        "SELECT tool, COUNT(*)::text AS count FROM vote_events GROUP BY tool"
      );
      const votes: VoteCounts = {};
      for (const row of rows) votes[row.tool] = Number(row.count);
      return votes;
    } catch (err) {
      console.error("getVotes db error:", err);
      return {};
    }
  }
  return readJson<VoteCounts>("votes.json", {});
}

/**
 * Record a "I use this" vote. Deduplicated per voter (user id when signed in,
 * otherwise a coarse IP key). Idempotent — re-voting doesn't double-count.
 * Returns the new total for the tool.
 */
export async function addVote(
  tool: string,
  voter: string
): Promise<{ ok: boolean; count: number }> {
  if (dbEnabled) {
    try {
      await query(
        `INSERT INTO vote_events (tool, voter) VALUES ($1, $2)
         ON CONFLICT (tool, voter) DO NOTHING`,
        [tool, voter]
      );
      const rows = await query<{ count: string }>(
        "SELECT COUNT(*)::text AS count FROM vote_events WHERE tool = $1",
        [tool]
      );
      return { ok: true, count: Number(rows[0]?.count ?? 0) };
    } catch (err) {
      console.error("addVote db error:", err);
      return { ok: false, count: 0 };
    }
  }
  // Legacy path: aggregate counter only (no dedup beyond client-side).
  const votes = await getVotes();
  votes[tool] = (votes[tool] ?? 0) + 1;
  const ok = await writeJson("votes.json", votes);
  return { ok, count: votes[tool] ?? 0 };
}

/** Retract a "I use this" vote. Returns the new total for the tool. */
export async function removeVote(
  tool: string,
  voter: string
): Promise<{ ok: boolean; count: number }> {
  if (dbEnabled) {
    try {
      await query("DELETE FROM vote_events WHERE tool = $1 AND voter = $2", [
        tool,
        voter,
      ]);
      const rows = await query<{ count: string }>(
        "SELECT COUNT(*)::text AS count FROM vote_events WHERE tool = $1",
        [tool]
      );
      return { ok: true, count: Number(rows[0]?.count ?? 0) };
    } catch (err) {
      console.error("removeVote db error:", err);
      return { ok: false, count: 0 };
    }
  }
  // Legacy path: decrement, floored at zero.
  const votes = await getVotes();
  votes[tool] = Math.max(0, (votes[tool] ?? 0) - 1);
  const ok = await writeJson("votes.json", votes);
  return { ok, count: votes[tool] ?? 0 };
}

/** Whether this voter has already voted for this tool (Postgres only). */
export async function hasVoted(tool: string, voter: string): Promise<boolean> {
  if (!dbEnabled) return false;
  try {
    const rows = await query<{ exists: boolean }>(
      "SELECT EXISTS(SELECT 1 FROM vote_events WHERE tool = $1 AND voter = $2)",
      [tool, voter]
    );
    return !!rows[0]?.exists;
  } catch (err) {
    console.error("hasVoted db error:", err);
    return false;
  }
}


export interface FlagReport {
  tool: string;
  reason: string;
  note: string;
  at: string;
}

export async function addFlag(report: Omit<FlagReport, "at">): Promise<boolean> {
  if (dbEnabled) {
    try {
      await query(
        "INSERT INTO flags (tool, reason, note) VALUES ($1, $2, $3)",
        [report.tool, report.reason, report.note]
      );
      return true;
    } catch (err) {
      console.error("addFlag db error:", err);
      return false;
    }
  }
  const flags = await readJson<FlagReport[]>("flags.json", []);
  flags.push({ ...report, at: new Date().toISOString() });
  return writeJson("flags.json", flags);
}

export async function getFlags(tool?: string): Promise<FlagReport[]> {
  if (dbEnabled) {
    try {
      const rows = await query<{
        tool: string;
        reason: string;
        note: string;
        created_at: string;
      }>(
        tool
          ? "SELECT tool, reason, note, created_at FROM flags WHERE tool = $1 ORDER BY created_at DESC"
          : "SELECT tool, reason, note, created_at FROM flags ORDER BY created_at DESC",
        tool ? [tool] : undefined
      );
      return rows.map((r) => ({
        tool: r.tool,
        reason: r.reason,
        note: r.note,
        at: new Date(r.created_at).toISOString(),
      }));
    } catch (err) {
      console.error("getFlags db error:", err);
      return [];
    }
  }
  const flags = await readJson<FlagReport[]>("flags.json", []);
  return tool ? flags.filter((f) => f.tool === tool) : flags;
}

export async function addSubscriber(email: string): Promise<boolean> {
  if (dbEnabled) {
    try {
      await query(
        "INSERT INTO subscribers (email) VALUES ($1) ON CONFLICT (email) DO NOTHING",
        [email]
      );
      return true;
    } catch (err) {
      console.error("addSubscriber db error:", err);
      return false;
    }
  }
  const subs = await readJson<{ email: string; at: string }[]>("subscribers.json", []);
  if (!subs.some((s) => s.email === email)) {
    subs.push({ email, at: new Date().toISOString() });
  }
  return writeJson("subscribers.json", subs);
}

/* ------------------------- Per-user data (auth) ------------------------- */

/** Bookmarks for a signed-in user, oldest first. */
export async function getBookmarks(userId: string): Promise<string[]> {
  if (!dbEnabled) return [];
  try {
    const rows = await query<{ tool: string }>(
      "SELECT tool FROM bookmarks WHERE user_id = $1 ORDER BY created_at ASC",
      [userId]
    );
    return rows.map((r) => r.tool);
  } catch (err) {
    console.error("getBookmarks db error:", err);
    return [];
  }
}

/** Add one bookmark. Idempotent. */
export async function addBookmark(userId: string, tool: string): Promise<boolean> {
  if (!dbEnabled) return false;
  try {
    await query(
      "INSERT INTO bookmarks (user_id, tool) VALUES ($1, $2) ON CONFLICT (user_id, tool) DO NOTHING",
      [userId, tool]
    );
    return true;
  } catch (err) {
    console.error("addBookmark db error:", err);
    return false;
  }
}

export async function removeBookmark(userId: string, tool: string): Promise<boolean> {
  if (!dbEnabled) return false;
  try {
    await query("DELETE FROM bookmarks WHERE user_id = $1 AND tool = $2", [
      userId,
      tool,
    ]);
    return true;
  } catch (err) {
    console.error("removeBookmark db error:", err);
    return false;
  }
}

/**
 * Merge a list of guest (localStorage) bookmarks into the user's account.
 * Union semantics: anything already saved stays, guest items are appended.
 */
export async function mergeBookmarks(
  userId: string,
  tools: string[]
): Promise<string[]> {
  if (!dbEnabled) return [];
  try {
    if (tools.length > 0) {
      await query(
        `INSERT INTO bookmarks (user_id, tool)
         SELECT $1, t FROM unnest($2::text[]) AS t
         ON CONFLICT (user_id, tool) DO NOTHING`,
        [userId, tools]
      );
    }
    return getBookmarks(userId);
  } catch (err) {
    console.error("mergeBookmarks db error:", err);
    return getBookmarks(userId);
  }
}

export async function getProfile(userId: string): Promise<string> {
  if (!dbEnabled) return "";
  try {
    const rows = await query<{ profile: string | null }>(
      "SELECT profile FROM profiles WHERE user_id = $1",
      [userId]
    );
    return rows[0]?.profile ?? "";
  } catch (err) {
    console.error("getProfile db error:", err);
    return "";
  }
}

export async function saveProfile(userId: string, profile: string): Promise<boolean> {
  if (!dbEnabled) return false;
  try {
    await query(
      `INSERT INTO profiles (user_id, profile, updated_at) VALUES ($1, $2, now())
       ON CONFLICT (user_id) DO UPDATE SET profile = $2, updated_at = now()`,
      [userId, profile]
    );
    return true;
  } catch (err) {
    console.error("saveProfile db error:", err);
    return false;
  }
}

/** Tools this user has voted for ("I use this"), by name. */
export async function getVotedTools(userId: string): Promise<string[]> {
  if (!dbEnabled) return [];
  try {
    const rows = await query<{ tool: string }>(
      "SELECT tool FROM vote_events WHERE voter = $1 ORDER BY created_at ASC",
      [`user:${userId}`]
    );
    return rows.map((r) => r.tool);
  } catch (err) {
    console.error("getVotedTools db error:", err);
    return [];
  }
}

/** Everything we know about a user's preferences, used to personalize recommendations. */
export interface UserSignals {
  profile: string;
  bookmarks: string[];
  votes: string[];
}

export async function getUserSignals(userId: string): Promise<UserSignals> {
  const [profile, bookmarks, votes] = await Promise.all([
    getProfile(userId),
    getBookmarks(userId),
    getVotedTools(userId),
  ]);
  return { profile, bookmarks, votes };
}

