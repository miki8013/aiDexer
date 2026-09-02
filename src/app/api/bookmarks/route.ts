import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  getBookmarks,
  addBookmark,
  removeBookmark,
  mergeBookmarks,
} from "@/lib/serverStore";
import { aiDatabase } from "../recommend/aiDatabase";

const securityHeaders = {
  "X-Content-Type-Options": "nosniff",
  "Cache-Control": "no-store",
};

const unauthorized = () =>
  NextResponse.json(
    { error: "Sign in to sync your shortlist.", unauthorized: true },
    { status: 401, headers: securityHeaders }
  );

function isValidTool(name: unknown): name is string {
  return typeof name === "string" && aiDatabase.some((t) => t.name === name);
}

async function currentUserId(request: NextRequest): Promise<string | null> {
  const session = await auth.api.getSession({ headers: request.headers });
  return session?.user?.id ?? null;
}

/** GET — the signed-in user's bookmarks. */
export async function GET(request: NextRequest) {
  const userId = await currentUserId(request);
  if (!userId) return unauthorized();
  const bookmarks = await getBookmarks(userId);
  return NextResponse.json({ bookmarks }, { headers: securityHeaders });
}

/**
 * POST — several modes:
 *  { tool, action: "add" | "remove" }  — toggle one bookmark
 *  { merge: [tool, ...] }              — union guest bookmarks into the account
 *                                        (idempotent; safe to call on sign-in)
 */
export async function POST(request: NextRequest) {
  let userId: string | null = null;
  try {
    userId = await currentUserId(request);
  } catch {
    return NextResponse.json(
      { error: "Auth is not configured on this deployment." },
      { status: 503, headers: securityHeaders }
    );
  }
  if (!userId) return unauthorized();

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json(
      { error: "Invalid request" },
      { status: 400, headers: securityHeaders }
    );
  }

  // Merge mode: union guest shortlist into the account, return the result.
  if (Array.isArray(body.merge)) {
    const tools = body.merge.filter(isValidTool).slice(0, 200);
    const bookmarks = await mergeBookmarks(userId, tools);
    return NextResponse.json({ bookmarks }, { headers: securityHeaders });
  }

  if (!isValidTool(body.tool)) {
    return NextResponse.json(
      { error: "Unknown tool" },
      { status: 400, headers: securityHeaders }
    );
  }

  if (body.action === "remove") {
    await removeBookmark(userId, body.tool);
  } else {
    await addBookmark(userId, body.tool);
  }

  const bookmarks = await getBookmarks(userId);
  return NextResponse.json({ bookmarks }, { headers: securityHeaders });
}
