/* One-off cleanup: removes the repro-* test users created during signup debugging. */
const { Client } = require("pg");

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("Set DATABASE_URL first");
  process.exit(1);
}

(async () => {
  const c = new Client({ connectionString: url });
  await c.connect();
  const ids = await c.query(
    "SELECT id FROM \"user\" WHERE email LIKE '%@aidexer-test.dev'"
  );
  for (const row of ids.rows) {
    await c.query("DELETE FROM session WHERE \"userId\" = $1", [row.id]);
    await c.query("DELETE FROM account WHERE \"userId\" = $1", [row.id]);
  }
  const r = await c.query("DELETE FROM \"user\" WHERE email LIKE '%@aidexer-test.dev'");
  console.log("deleted test users:", r.rowCount);
  await c.end();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
