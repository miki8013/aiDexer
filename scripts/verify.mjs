import { Client } from "pg";
const c = new Client({
  connectionString: process.env.DATABASE_URL,
});
try {
  await c.connect();
  const r = await c.query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY 1");
  console.log("Tables:", r.rows.map((x) => x.tablename).join(", "));
} catch (e) {
  console.error("ERROR:", e.message);
  process.exitCode = 1;
} finally {
  await c.end();
}
