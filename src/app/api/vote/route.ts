import { NextRequest, NextResponse } from "next/server";
import { aiDatabase } from "../recommend/aiDatabase";
import { getVotes, addVote, removeVote, hasVoted } from "@/lib/serverStore";

const securityHeaders = {
  "X-Content-Type-Options": "nosniff",
  "Cache-Control": "no-store",
};

const RATE_LIMIT = new Map<string, { count: number; reset: number }>();
function checkRate(ip: string, limit = 30, windowMs = 60_000): boolean {
  const now = Date.now();
  const rec = RATE_LIMIT.get(ip);
  if (!rec || now > rec.reset) {
    RATE_LIMIT.set(ip, { count: 1, reset: now + windowMs });
    return true;
  }
  if (rec.count >= limit) return false;
  rec.count++;
  return true;
}

function isValidTool(name: unknown): name is string {
  return typeof name === "string" && aiDatabase.some((t) => t.name === name);
}

/** GET /api/vote?tool=<name> for one tool, or no param for all counts. */
export async function GET(request: NextRequest) {
  const tool = request.nextUrl.searchParams.get("tool");
  const votes = await getVotes();
  if (tool) {
    return NextResponse.json(
      { tool, count: votes[tool] ?? 0 },
      { headers: securityHeaders }
    );
  }
  return NextResponse.json({ votes }, { headers: securityHeaders });
}

/**
 * POST { tool, action: "use" | "unuse" } — reversible "I use this" counter,
 * deduped per voter (one vote per person per tool; toggling retracts it).
 */
export async function POST(request: NextRequest) {
  try {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "anonymous";
    if (!checkRate(ip)) {
      return NextResponse.json(
        { error: "Too many votes — try again in a minute." },
        { status: 429, headers: securityHeaders }
      );
    }

    const body = await request.json().catch(() => null);
    if (!body || !isValidTool(body.tool)) {
      return NextResponse.json(
        { error: "Unknown tool" },
        { status: 400, headers: securityHeaders }
      );
    }
    const action = body.action === "unuse" ? "unuse" : "use";

    // Signed-in users are deduped by user id; guests by a coarse IP key.
    let voter = `ip:${ip}`;
    try {
      const { auth } = await import("@/lib/auth");
      const session = await auth.api.getSession({ headers: request.headers });
      if (session?.user?.id) voter = `user:${session.user.id}`;
    } catch {
      // auth not configured — keep the ip voter
    }

    const { ok, count } =
      action === "use"
        ? await addVote(body.tool, voter)
        : await removeVote(body.tool, voter);

    // Report the server's truth so the client can't drift out of sync.
    const voted = ok ? await hasVoted(body.tool, voter) : action === "use";
    return NextResponse.json(
      { tool: body.tool, count, ok, voted },
      { status: ok ? 200 : 503, headers: securityHeaders }
    );
  } catch (err) {
    console.error("vote error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: securityHeaders }
    );
  }
}


