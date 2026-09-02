import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";
import { NextResponse } from "next/server";

const securityHeaders = {
  "Cache-Control": "no-store",
};

function notConfigured() {
  return NextResponse.json(
    { error: "Auth is not configured on this deployment (missing DATABASE_URL)." },
    { status: 503, headers: securityHeaders }
  );
}

const handler = toNextJsHandler(auth);

// Wrap so a server-side failure is visible in the response body and in the
// Vercel function logs instead of an empty HTTP 500.
async function run(
  fn: (request: Request) => Promise<Response>,
  request: Request
): Promise<Response> {
  if (!process.env.DATABASE_URL) return notConfigured();
  try {
    return await fn(request);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[auth] handler error:", err);
    return NextResponse.json(
      { error: "Auth request failed.", detail: message },
      { status: 500, headers: securityHeaders }
    );
  }
}

export async function GET(request: Request) {
  return run(handler.GET, request);
}

export async function POST(request: Request) {
  return run(handler.POST, request);
}


