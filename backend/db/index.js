/* ============================================================
   MySQL LAYER (Sequelize + mysql2) — replaces Mongoose/MongoDB.

   Configuration comes from environment variables (see .env.example):
     DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD
   The data migration utility additionally reads MONGODB_URI (it is
   the only component allowed to touch MongoDB).

   Notes
   - decimalNumbers: true → DECIMAL columns arrive as JS numbers, so
     every wallet/math path keeps the exact numeric behaviour the
     Mongoose build had (no string-typed rupees).
   - Pool sized for Passenger/shared hosting (small + bounded).
   - utf8mb4 + unicode_ci collation keeps the schema portable across
     MySQL 5.7/8 and MariaDB (cPanel).
   ============================================================ */

const Sequelize = require("sequelize");

const DB_NAME = process.env.DB_NAME || "nikecode";
const DB_USER = process.env.DB_USER || "nikecode";
const DB_PASSWORD = process.env.DB_PASSWORD || "";
const DB_HOST = process.env.DB_HOST || "127.0.0.1";
const DB_PORT = Number(process.env.DB_PORT || 3306);
const DB_POOL_MAX = Number(process.env.DB_POOL_MAX || 5);
const DB_POOL_MIN = Number(process.env.DB_POOL_MIN || 0);
const DB_LOG_SQL = process.env.DB_LOG_SQL === "1";

if (!DB_PASSWORD && process.env.DB_REQUIRE_PASSWORD === "1") {
  console.error("DB_PASSWORD missing in backend/.env");
  process.exit(1);
}

const sequelize = new Sequelize(DB_NAME, DB_USER, DB_PASSWORD, {
  host: DB_HOST,
  port: DB_PORT,
  dialect: "mysql",
  logging: DB_LOG_SQL ? console.log : false,
  /* DECIMAL → JS number (money stays numeric, API contracts unchanged) */
  dialectOptions: { decimalNumbers: true },
  pool: {
    max: DB_POOL_MAX,
    min: DB_POOL_MIN,
    acquire: 30000,
    idle: 10000,
    evict: 60000,
  },
  define: {
    underscored: true, /* createdAt → created_at */
    freezeTableName: true,
  },
  timezone: "+00:00", /* store UTC like MongoDB did — IST conversions stay in app code */
});

/* ---- atomic money helpers --------------------------------------------
   MongoDB used atomic $inc with a guard filter. The MySQL twins below
   compile to a single UPDATE ... SET col = col ± ? WHERE ... statement,
   so the claim/increment semantics are preserved exactly (row-level
   atomicity + affectedRows as the race winner check).

   These take COLUMN names (snake_case) — values are Number()-coerced
   before interpolation so no user string ever reaches the literal. */
const inc = (column, amount) =>
  Sequelize.literal("`" + column + "` + " + Number(amount));
const dec = (column, amount) =>
  Sequelize.literal("`" + column + "` - " + Number(amount));

module.exports = { sequelize, Sequelize, Op: Sequelize.Op, inc, dec, DB_NAME, DB_HOST, DB_PORT };
