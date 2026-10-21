/* ============================================================
   MIGRATION RUNNER — applies db/migrations/*.sql in order.
   Applied files are tracked in _migrations (idempotent).
   Usage:
     node backend/db/migrate.js              (uses DB_* env vars)
     node backend/db/migrate.js --fresh      (DANGER: drops the DB first)
   The --fresh flag is for local/test environments only.
   ============================================================ */

const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const DB_NAME = process.env.DB_NAME || "nikecode";
const DB_USER = process.env.DB_USER || "nikecode";
const DB_PASSWORD = process.env.DB_PASSWORD || "";
const DB_HOST = process.env.DB_HOST || "127.0.0.1";
const DB_PORT = Number(process.env.DB_PORT || 3306);

async function runMigrations({ fresh = false, log = console.log } = {}) {
  /* server-level connection (needs CREATE DATABASE on first run) */
  const boot = await mysql.createConnection({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASSWORD,
    multipleStatements: false,
  });
  try {
    await boot.query(
      "CREATE DATABASE IF NOT EXISTS `" +
        DB_NAME.replace(/`/g, "") +
        "` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
    );
  } catch (e) {
    /* Shared-hosting accounts (cPanel / aaPanel) are scoped to their own
       database and lack the GLOBAL CREATE privilege, so the statement above
       can be rejected even when the database already exists (panel-created).
       In that case verify the DB is actually usable and continue. */
    const noGlobalCreate =
      ["ER_DBACCESS_DENIED_ERROR", "ER_ACCESS_DENIED_ERROR"].includes(e.code) ||
      [1044, 1045].includes(e.errno);
    if (!noGlobalCreate) throw e;
    const chk = await mysql.createConnection({
      host: DB_HOST,
      port: DB_PORT,
      user: DB_USER,
      password: DB_PASSWORD,
      database: DB_NAME,
    });
    await chk.query("SELECT 1");
    await chk.end();
    log(
      "note: CREATE DATABASE skipped (no global CREATE privilege — normal on shared hosting); using existing database '" +
        DB_NAME +
        "'"
    );
  } finally {
    await boot.end();
  }

  if (fresh) {
    const c = await mysql.createConnection({
      host: DB_HOST,
      port: DB_PORT,
      user: DB_USER,
      password: DB_PASSWORD,
      database: DB_NAME,
      multipleStatements: true,
    });
    await c.query(
      "SET FOREIGN_KEY_CHECKS=0; " +
        "SHOW TABLES" /* placeholder replaced below */
    ).catch(() => {});
    const [tables] = await c.query("SHOW TABLES");
    const names = tables.map((t) => Object.values(t)[0]);
    for (const t of names) {
      await c.query("DROP TABLE IF EXISTS `" + t.replace(/`/g, "") + "`");
    }
    await c.query("SET FOREIGN_KEY_CHECKS=1");
    await c.end();
    log("fresh: dropped " + names.length + " table(s)");
  }

  const db = await mysql.createConnection({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME,
    multipleStatements: true, /* one file = one batch */
    decimalNumbers: true,
  });

  await db.query(
    "CREATE TABLE IF NOT EXISTS _migrations (name VARCHAR(100) NOT NULL PRIMARY KEY, applied_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)) ENGINE=InnoDB"
  );
  const [done] = await db.query("SELECT name FROM _migrations");
  const applied = new Set(done.map((r) => r.name));

  const dir = path.join(__dirname, "migrations");
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  let ran = 0;
  for (const f of files) {
    if (applied.has(f)) continue;
    const sql = fs.readFileSync(path.join(dir, f), "utf8");
    await db.query(sql);
    await db.query("INSERT INTO _migrations (name) VALUES (?)", [f]);
    log("applied:", f);
    ran++;
  }
  await db.end();
  if (!ran) log("migrations: up to date (" + files.length + " file(s))");
  return { ran, total: files.length };
}

if (require.main === module) {
  runMigrations({ fresh: process.argv.includes("--fresh") })
    .then(() => process.exit(0))
    .catch((e) => {
      console.error("migration failed:", e.message);
      process.exit(1);
    });
}

module.exports = { runMigrations };
