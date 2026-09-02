import { NextRequest, NextResponse } from "next/server";
import { aiDatabase } from "../recommend/aiDatabase";
import { getVotes, addVote } from "@/lib/serverStore";

const securityHeaders = {
  "X-Content-Type-Options": "nosniff",
  "Cache-Control": "no-store",
};

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

/** POST { tool, action: "use" } — "I use this" counter, deduped per voter. */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    if (!body || !isValidTool(body.tool)) {
      return NextResponse.json(
        { error: "Unknown tool" },
        { status: 400, headers: securityHeaders }
      );
    }

    // Signed-in users are deduped by user id; guests by a coarse IP key.
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "anonymous";
    let voter = `ip:${ip}`;
    try {
      const { auth } = await import("@/lib/auth");
      const session = await auth.api.getSession({ headers: request.headers });
      if (session?.user?.id) voter = `user:${session.user.id}`;
    } catch {
      // auth not configured — keep the ip voter
    }

    const { ok, count } = await addVote(body.tool, voter);
    return NextResponse.json(
      { tool: body.tool, count, ok },
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

