/**
 * Reproduces a better-auth email sign-up against DATABASE_URL to surface the
 * real server error behind the opaque HTTP 500.
 * Usage: $env:DATABASE_URL="postgres://..."; npx tsx scripts/repro-signup.mts
 */
process.env.BETTER_AUTH_SECRET ||= "local-repro-secret-0123456789abcdef";

const { auth } = await import("../src/lib/auth");

const email = `repro-${Date.now()}@aidexer-test.dev`;
const req = new Request("http://localhost:3000/api/auth/sign-up/email", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email, password: "testpass123", name: "Repro" }),
});
try {
  const res = await auth.handler(req);
  const text = await res.text();
  console.log("STATUS:", res.status);
  console.log("BODY:", text.slice(0, 500));
} catch (err) {
  console.error("THROWN:", err);
}
process.exit(0);
