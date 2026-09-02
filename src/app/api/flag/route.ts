import { NextRequest, NextResponse } from "next/server";
import { aiDatabase } from "../recommend/aiDatabase";
import { addFlag, getFlags } from "@/lib/serverStore";

const securityHeaders = {
  "X-Content-Type-Options": "nosniff",
  "Cache-Control": "no-store",
};

const RATE_LIMIT = new Map<string, { count: number; reset: number }>();
function checkRate(ip: string, limit = 10, windowMs = 60_000): boolean {
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

const REASONS = ["Pricing changed", "Tool discontinued", "Wrong info", "Link broken"];

/** GET /api/flag?tool=<name> — flags for one tool (or all). */
export async function GET(request: NextRequest) {
  const tool = request.nextUrl.searchParams.get("tool") ?? undefined;
  const flags = await getFlags(tool);
  return NextResponse.json({ flags }, { headers: securityHeaders });
}

/** POST { tool, reason, note } — crowdsourced "this info is outdated" report. */
export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "anonymous";
    if (!checkRate(ip)) {
      return NextResponse.json({ error: "Too many reports. Try later." }, { status: 429, headers: securityHeaders });
    }

    const body = await request.json().catch(() => null);
    const tool = body?.tool;
    const reason = body?.reason;
    const note = typeof body?.note === "string" ? body.note.trim().slice(0, 500) : "";
    if (
      typeof tool !== "string" ||
      !aiDatabase.some((t) => t.name === tool) ||
      !REASONS.includes(reason)
    ) {
      return NextResponse.json({ error: "Invalid report" }, { status: 400, headers: securityHeaders });
    }

    await addFlag({ tool, reason, note });
    return NextResponse.json({ ok: true }, { headers: securityHeaders });
  } catch (err) {
    console.error("flag error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500, headers: securityHeaders });
  }
}

export { };

