import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { getPool } from "@/lib/db";

/**
 * Better Auth instance — email + password sign-in with sessions persisted in
 * Postgres (Neon via Vercel). Guest browsing requires no account at all;
 * accounts exist only to sync bookmarks, profile, and votes across devices.
 *
 * Migrations: run `npx auth@latest migrate` with DATABASE_URL set to create
 * the auth tables (user, session, account, verification). App tables live in
 * db/schema.sql.
 */
export const auth = betterAuth({
  secret:
    process.env.BETTER_AUTH_SECRET ??
    "dev-only-insecure-secret-change-me-in-production-0123456789",
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
