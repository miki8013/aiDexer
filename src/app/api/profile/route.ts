import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getProfile, saveProfile } from "@/lib/serverStore";

const securityHeaders = {
  "X-Content-Type-Options": "nosniff",
  "Cache-Control": "no-store",
};

/** GET — the signed-in user's saved profile, e.g. "I'm a solo dev". */
export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user?.id) {
      return NextResponse.json(
        { profile: "", unauthorized: true },
        { headers: securityHeaders }
      );
    }
    const profile = await getProfile(session.user.id);
    return NextResponse.json({ profile }, { headers: securityHeaders });
  } catch {
    return NextResponse.json(
      { profile: "", error: "Auth is not configured on this deployment." },
      { status: 503, headers: securityHeaders }
    );
  }
}

/** PUT { profile } — save the profile used to personalize recommendations. */
export async function PUT(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Sign in to save your profile.", unauthorized: true },
        { status: 401, headers: securityHeaders }
      );
    }
    const body = await request.json().catch(() => null);
    const profile =
      typeof body?.profile === "string" ? body.profile.trim().slice(0, 200) : "";
    const ok = await saveProfile(session.user.id, profile);
    return NextResponse.json(
      { ok, profile },
      { status: ok ? 200 : 503, headers: securityHeaders }
    );
  } catch (err) {
    console.error("profile route error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: securityHeaders }
    );
  }
}
