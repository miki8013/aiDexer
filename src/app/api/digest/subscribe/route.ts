import { NextRequest, NextResponse } from "next/server";
import { addSubscriber } from "@/lib/serverStore";

const securityHeaders = {
  "X-Content-Type-Options": "nosniff",
  "Cache-Control": "no-store",
};

/** POST { email } — subscribe to the weekly "new AI tools" digest. */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 254) {
      return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400, headers: securityHeaders });
    }
    const ok = await addSubscriber(email);
    return NextResponse.json(
      { ok, stored: ok, message: ok ? "You're on the list!" : "Subscription saved locally (storage unavailable)." },
      { headers: securityHeaders }
    );
  } catch (err) {
    console.error("digest subscribe error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500, headers: securityHeaders });
  }
}
