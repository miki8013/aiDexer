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

export async function GET(...args: Parameters<typeof handler.GET>) {
  if (!process.env.DATABASE_URL) return notConfigured();
  return handler.GET(...args);
}

export async function POST(...args: Parameters<typeof handler.POST>) {
  if (!process.env.DATABASE_URL) return notConfigured();
  return handler.POST(...args);
}
