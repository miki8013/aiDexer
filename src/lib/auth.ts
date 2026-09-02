import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { getPool } from "@/lib/db";

/**
 * Better Auth instance — email + password sign-in with sessions persisted in
 * Postgres (Neon via Vercel). Guest browsing requires no account at all;
 * accounts exist only to sync bookmarks, profile, and votes across devices.
 */

// Resolve the site URL across environments: explicit override, then Vercel's
// automatic URL env vars, then local dev. Without this, better-auth derives
// the origin per-request, which breaks on Vercel preview deployments.
const siteUrlCandidates = [
  process.env.BETTER_AUTH_URL,
  process.env.NEXT_PUBLIC_SITE_URL,
  process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "",
  process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "",
].filter(Boolean) as string[];
const siteUrl = siteUrlCandidates[0] ?? "";

const allowedOrigins = [
  siteUrl,
  process.env.BETTER_AUTH_URL,
  process.env.NEXT_PUBLIC_SITE_URL,
  // Vercel injects the deployment + production + preview URLs automatically.
  process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "",
  "http://localhost:3000",
].filter(Boolean) as string[];

export const auth = betterAuth({
  secret:
    process.env.BETTER_AUTH_SECRET ??
    "dev-only-insecure-secret-change-me-in-production-0123456789",
  ...(siteUrl ? { baseURL: siteUrl } : {}),
  trustedOrigins: allowedOrigins,
  database: getPool(),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 days
    updateAge: 60 * 60 * 24, // refresh every day
  },
  plugins: [nextCookies()],
});

