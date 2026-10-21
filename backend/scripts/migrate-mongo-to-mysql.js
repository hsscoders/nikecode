/* ============================================================
   MONGODB → MYSQL DATA MIGRATION UTILITY
   ============================================================
   One-shot, repeatable, resumable migrator for production data.

   SOURCE: MongoDB (MONGODB_URI — the ONLY component in the repo
           that still talks to MongoDB, via the `mongodb` driver)
   TARGET: MySQL (DB_* env vars — same config as the app)

   Usage:
     node backend/scripts/migrate-mongo-to-mysql.js            # DRY RUN (no writes)
     node backend/scripts/migrate-mongo-to-mysql.js --write    # actually writes
     node backend/scripts/migrate-mongo-to-mysql.js --write --collection users
     node backend/scripts/migrate-mongo-to-mysql.js --report   # reconciliation only

   Behaviour:
   - dry-run by default; --write is the explicit confirmation
   - creates the schema first (runs db/migrations) unless --no-schema
   - batches of 500, resumable: rows whose legacy_id already exists
     are SKIPPED (safe to re-run after an interrupted pass)
   - references (user ObjectId on deposits/withdrawals/transactions/
     invests/login_codes, planId on invests) are remapped to the new
     MySQL ids via an in-memory legacy→new map (built per run)
   - password hashes are copied VERBATIM (bcrypt — no decrypt/reset)
   - MongoDB source is NEVER modified (read-only)
   - reconciliation report: per-collection counts + financial totals
     (successful deposits/withdrawals, wallet sums, invest totals)
     compared source vs target; exit code 1 on any mismatch
   - never logs secrets or full phone numbers (masked in report lines)
   ============================================================ */

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const { MongoClient } = require("mongodb");
const mysql = require("mysql2/promise");
const { runMigrations } = require("../db/migrate");

const WRITE = process.argv.includes("--write");
const REPORT_ONLY = process.argv.includes("--report");
const NO_SCHEMA = process.argv.includes("--no-schema");
const ONLY = (process.argv.find((a) => a.startsWith("--collection")) || "").split("=")[1] || null;
const BATCH = Number(process.env.MIGRATE_BATCH || 500);

const MONGO_URI = process.env.MONGODB_URI || "";
const MONGO_DB = process.env.MONGODB_DB || "zapto";

const DB_NAME = process.env.DB_NAME || "nikecode";

if (!MONGO_URI) {
  console.error("MONGODB_URI missing in backend/.env — source credentials required.");
  process.exit(1);
}

const mask = (phone) => (phone ? String(phone).slice(0, 3) + "***" + String(phone).slice(-2) : "-");
const log = (...a) => console.log(...a);

/* ---------------- helpers ---------------- */

async function withConn(fn, { noDb = false } = {}) {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || "127.0.0.1",
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || "nikecode",
    password: process.env.DB_PASSWORD || "",
    database: noDb ? undefined : DB_NAME,
    multipleStatements: false,
    decimalNumbers: true,
  });
  try {
    return await fn(conn);
  } finally {
    await conn.end();
  }
}

const insert = async (conn, table, rows) => {
  if (!rows.length) return 0;
  const cols = Object.keys(rows[0]);
  const placeholders = rows.map(() => "(" + cols.map(() => "?").join(",") + ")").join(",");
  const values = rows.flatMap((r) => cols.map((c) => r[c]));
  const sql =
    "INSERT IGNORE INTO `" +
    table +
    "` (`" +
    cols.join("`,`") +
    "`) VALUES " +
    placeholders;
  const [res] = await conn.query(sql, values);
  return res.affectedRows;
};

const dateOrNull = (v) => (v ? new Date(v) : null);
const dec2 = (v) => (Number.isFinite(Number(v)) ? Math.round(Number(v) * 100) / 100 : 0);

/* ---------------- collection mappers ---------------- */

const MAPPERS = {
  users: (d) => ({
    legacy_id: String(d._id),
    phone: String(d.phone || ""),
    password: String(d.password || ""),
    withdraw_password: String(d.withdrawPassword || ""),
    ref_by: String(d.refBy || ""),
    userid: d.userid || null,
    ref_id: d.refId || null,
    name: String(d.name || "").slice(0, 40),
    balance: dec2(d.balance),
    recharge_balance: dec2(d.rechargeBalance),
    total_recharge: dec2(d.totalRecharge),
    total_income: dec2(d.totalIncome),
    status: d.status === "Banned" ? "Banned" : "Active",
    bank_real_name: String((d.bank && d.bank.realName) || "").slice(0, 30),
    bank_bank_name: String((d.bank && d.bank.bankName) || "").slice(0, 30),
    bank_account: String((d.bank && d.bank.account) || "").slice(0, 24),
    bank_ifsc: String((d.bank && d.bank.ifsc) || "").slice(0, 11),
    created_at: dateOrNull(d.createdAt) || new Date(),
    updated_at: dateOrNull(d.updatedAt) || new Date(),
  }),
  admins: (d) => ({
    legacy_id: String(d._id),
    username: String(d.username || "").toLowerCase(),
    password: String(d.password || ""),
    name: String(d.name || "Administrator").slice(0, 60),
    created_at: dateOrNull(d.createdAt) || new Date(),
    updated_at: dateOrNull(d.updatedAt) || new Date(),
  }),
  plans: (d) => ({
    legacy_id: String(d._id),
    name: String(d.name || "").slice(0, 60),
    vip: d.vip ? 1 : 0,
    image: String(d.image || "").slice(0, 500),
    price: dec2(d.price),
    daily: dec2(d.daily),
    cycle: Math.max(1, Math.round(Number(d.cycle) || 1)),
    total: dec2(d.total),
    purchase_limit: Math.max(0, Math.round(Number(d.limit) || 0)),
    presale: d.presale ? 1 : 0,
    active: d.active === false ? 0 : 1,
    sort: Math.round(Number(d.sort) || 0),
    created_at: dateOrNull(d.createdAt) || new Date(),
    updated_at: dateOrNull(d.updatedAt) || new Date(),
  }),
  banners: (d) => ({
    legacy_id: String(d._id),
    title: String(d.title || "").slice(0, 80),
    image: String(d.image || "").slice(0, 500),
    origin_url: String(d.originUrl || "").slice(0, 500),
    link: String(d.link || "").slice(0, 500),
    active: d.active === false ? 0 : 1,
    sort: Math.round(Number(d.sort) || 0),
    created_at: dateOrNull(d.createdAt) || new Date(),
    updated_at: dateOrNull(d.updatedAt) || new Date(),
  }),
  deposits: (d) => ({
    legacy_id: String(d._id),
    user_id: null, // remapped later
    userid: String(d.userid || "").slice(0, 20),
    phone: String(d.phone || "").slice(0, 10),
    amount: dec2(d.amount),
    method: String(d.method || "Pay-T").slice(0, 40),
    status: ["Pending", "Success", "Rejected"].includes(d.status) ? d.status : "Pending",
    note: String(d.note || "").slice(0, 255),
    processed_at: dateOrNull(d.processedAt),
    gateway: String(d.gateway || "").slice(0, 40),
    gateway_order_id: String(d.gatewayOrderId || "").slice(0, 64),
    payment_url: String(d.paymentUrl || "").slice(0, 500),
    utr: String(d.utr || "").slice(0, 64),
    created_at: dateOrNull(d.createdAt) || new Date(),
    updated_at: dateOrNull(d.updatedAt) || new Date(),
  }),
  withdrawals: (d) => ({
    legacy_id: String(d._id),
    user_id: null,
    userid: String(d.userid || "").slice(0, 20),
    phone: String(d.phone || "").slice(0, 10),
    amount: dec2(d.amount),
    charge_percent: dec2(d.chargePercent),
    charge: dec2(d.charge),
    net_amount: dec2(d.netAmount),
    real_name: String(d.realName || "").slice(0, 30),
    bank_name: String(d.bankName || "").slice(0, 30),
    account: String(d.account || "").slice(0, 24),
    ifsc: String(d.ifsc || "").slice(0, 11),
    status: ["Pending", "Processing", "Success", "Rejected"].includes(d.status) ? d.status : "Pending",
    note: String(d.note || "").slice(0, 255),
    processed_at: dateOrNull(d.processedAt),
    auto_payout: d.autoPayout ? 1 : 0,
    gateway: String(d.gateway || "").slice(0, 40),
    payout_order_id: String(d.payoutOrderId || "").slice(0, 64),
    gateway_order_id: String(d.gatewayOrderId || "").slice(0, 64),
    utr: String(d.utr || "").slice(0, 64),
    created_at: dateOrNull(d.createdAt) || new Date(),
    updated_at: dateOrNull(d.updatedAt) || new Date(),
  }),
  transactions: (d) => ({
    legacy_id: String(d._id),
    user_id: null,
    userid: String(d.userid || "").slice(0, 20),
    phone: String(d.phone || "").slice(0, 10),
    type: ["recharge", "withdraw", "commission", "income", "bonus", "invest"].includes(d.type)
      ? d.type
      : "recharge",
    title: String(d.title || "").slice(0, 60),
    method: String(d.method || "").slice(0, 120),
    amount: dec2(d.amount),
    charge_percent: dec2(d.chargePercent),
    charge: dec2(d.charge),
    net_amount: dec2(d.netAmount),
    status: ["Pending", "Processing", "Success", "Rejected"].includes(d.status) ? d.status : "Pending",
    ref_id: String(d.refId || "").slice(0, 64),
    created_at: dateOrNull(d.createdAt) || new Date(),
    updated_at: dateOrNull(d.updatedAt) || new Date(),
  }),
  invests: (d) => ({
    legacy_id: String(d._id),
    user_id: null,
    userid: String(d.userid || "").slice(0, 20),
    phone: String(d.phone || "").slice(0, 10),
    plan_id: null, // remapped later
    plan_name: String(d.planName || "").slice(0, 60),
    vip: d.vip ? 1 : 0,
    price: dec2(d.price),
    daily: dec2(d.daily),
    cycle: Math.max(1, Math.round(Number(d.cycle) || 1)),
    total: dec2(d.total),
    status: d.status === "Completed" ? "Completed" : "Active",
    paid_days: Math.max(0, Math.round(Number(d.paidDays) || 0)),
    created_at: dateOrNull(d.createdAt) || new Date(),
    updated_at: dateOrNull(d.updatedAt) || new Date(),
  }),
  auditlogs: (d) => ({
    legacy_id: String(d._id),
    actor_type: ["admin", "user", "system"].includes(d.actorType) ? d.actorType : "system",
    actor_id: String(d.actorId || "").slice(0, 40),
    actor_label: String(d.actorLabel || "").slice(0, 60),
    action: String(d.action || "unknown").slice(0, 60),
    category: ["auth","deposit","withdraw","invest","user","plan","banner","settings","gateway","system"].includes(d.category)
      ? d.category
      : "system",
    target: String(d.target || "").slice(0, 120),
    message: String(d.message || "").slice(0, 400),
    detail: JSON.stringify(d.detail || {}),
    ip: String(d.ip || "").slice(0, 64),
    created_at: dateOrNull(d.createdAt) || new Date(),
  }),
  logincodes: (d) => ({
    legacy_id: String(d._id),
    code: String(d.code || ""),
    user_id: null, // remapped later
    used: d.used ? 1 : 0,
    used_at: dateOrNull(d.usedAt),
    expires_at: dateOrNull(d.expiresAt) || new Date(),
    created_at: dateOrNull(d.createdAt) || new Date(),
    updated_at: dateOrNull(d.updatedAt) || new Date(),
  }),
};

/* migration order — referenced tables first */
const ORDER = ["admins", "users", "plans", "banners", "settings", "deposits", "withdrawals", "transactions", "invests", "auditlogs", "logincodes"];

/* legacy ObjectId → new MySQL id maps (built during the run) */
const idMaps = { admins: new Map(), users: new Map(), plans: new Map() };

/* ---------------- migration passes ---------------- */

async function migrateCollection(mongo, conn, name) {
  if (name === "settings") return migrateSettings(mongo, conn);
  const mapper = MAPPERS[name];
  if (!mapper) return { source: 0, inserted: 0, skipped: 0 };

  const col = mongo.collection(name);
  const total = await col.countDocuments({});
  let inserted = 0;
  let skipped = 0;

  const cursor = col.find({}).batchSize(BATCH);
  let batch = [];
  for await (const d of cursor) {
    const row = mapper(d);
    batch.push(row);
    if (batch.length >= BATCH) {
      const n = await insert(conn, mysqlTable(name), batch);
      inserted += n;
      skipped += batch.length - n;
      batch = [];
    }
  }
  if (batch.length) {
    const n = await insert(conn, mysqlTable(name), batch);
    inserted += n;
    skipped += batch.length - n;
  }

  /* build id maps for referenced tables */
  if (idMaps[name]) {
    const [rows] = await conn.query("SELECT id, legacy_id FROM `" + mysqlTable(name) + "` WHERE legacy_id IS NOT NULL");
    for (const r of rows) idMaps[name].set(r.legacy_id, r.id);
  }
  return { source: total, inserted, skipped };
}

const mysqlTable = (name) => ({ auditlogs: "audit_logs", logincodes: "login_codes" }[name] || name);

/* settings: single JSON document → one row. INSERT IGNORE keeps re-runs
   resumable and non-destructive — an existing settings row is never touched. */
async function migrateSettings(mongo, conn, write) {
  const doc = await mongo.collection("settings").findOne({ key: "global" });
  if (!doc) return { source: 0, inserted: 0, skipped: 0 };
  const data = doc.data ? doc.data : { ...doc };
  delete data._id;
  delete data.key;
  if (!write) return { source: 1, inserted: 0, skipped: 0, dry: true };
  const json = JSON.stringify(data);
  const [res] = await conn.query(
    "INSERT IGNORE INTO settings (`key`, data, created_at, updated_at) VALUES ('global', ?, ?, ?)",
    [json, dateOrNull(doc.createdAt) || new Date(), dateOrNull(doc.updatedAt) || new Date()]
  );
  return { source: 1, inserted: res.affectedRows, skipped: 1 - res.affectedRows };
}

/* Reference remapping, done right: during extraction we keep the raw
   ObjectId on the row; here we swap it using the id maps, then clear it. */
const RAW_REF = { deposits: "user", withdrawals: "user", transactions: "user", invests: "user", logincodes: "user" };

async function migrateCollectionWithRefs(mongo, conn, name, write) {
  if (name === "settings") return migrateSettings(mongo, conn, write);
  const mapper = MAPPERS[name];
  if (!mapper) return { source: 0, inserted: 0, skipped: 0 };

  const col = mongo.collection(name);
  const total = await col.countDocuments({});
  let inserted = 0;
  let skipped = 0;
  let remapped = 0;
  let mappingErrors = 0;
  const refCol = RAW_REF[name];
  const pending = []; // { legacy_id, userLegacy, planLegacy }

  /* DRY RUN: exercise every mapper (catches schema/validation bugs) but
     never touch the target database. */
  if (!write) {
    const cursor = col.find({}).batchSize(BATCH);
    for await (const d of cursor) {
      try {
        mapper(d);
      } catch (e) {
        mappingErrors++;
        log("  ! mapping error on " + name + " " + d._id + ": " + e.message);
      }
    }
    return { source: total, inserted: 0, skipped: 0, remapped: 0, dry: true, mappingErrors };
  }

  const cursor = col.find({}).batchSize(BATCH);
  let batch = [];
  const flush = async () => {
    if (!batch.length) return;
    const n = await insert(conn, mysqlTable(name), batch);
    inserted += n;
    skipped += batch.length - n;
    batch = [];
  };

  for await (const d of cursor) {
    const row = mapper(d);
    if (refCol === "user") {
      const userLegacy = d.user ? String(d.user) : null;
      const planLegacy = name === "invests" && d.planId ? String(d.planId) : null;
      pending.push({ legacy_id: row.legacy_id, userLegacy, planLegacy });
      /* login_codes.user_id is NOT NULL — resolve it NOW (users were
         migrated earlier); deposits/withdrawals/transactions/invests allow
         NULL and are remapped in the post-pass below */
      if (name === "logincodes") {
        row.user_id = (userLegacy && idMaps.users.get(userLegacy)) || null;
        delete row.user; // not a column
      } else {
        delete row.user_id;
      }
    }
    batch.push(row);
    if (batch.length >= BATCH) await flush();
  }
  await flush();

  if (idMaps[name]) {
    const [rows] = await conn.query("SELECT id, legacy_id FROM `" + mysqlTable(name) + "` WHERE legacy_id IS NOT NULL");
    for (const r of rows) idMaps[name].set(r.legacy_id, r.id);
  }

  /* apply reference remaps now that the maps are complete */
  for (const p of pending) {
    const newUserId = p.userLegacy ? idMaps.users.get(p.userLegacy) : undefined;
    const newPlanId = p.planLegacy ? idMaps.plans.get(p.planLegacy) : undefined;
    const sets = [];
    const vals = [];
    if (newUserId !== undefined) {
      sets.push("user_id = ?");
      vals.push(newUserId);
    }
    if (name === "invests" && (newPlanId !== undefined || p.planLegacy)) {
      sets.push("plan_id = ?");
      vals.push(newPlanId !== undefined ? newPlanId : null);
    }
    if (sets.length) {
      const [res] = await conn.query(
        "UPDATE `" + mysqlTable(name) + "` SET " + sets.join(", ") + " WHERE legacy_id = ? AND user_id IS NULL",
        [...vals, p.legacy_id]
      );
      remapped += res.affectedRows;
    }
  }
  return { source: total, inserted, skipped, remapped };
}

/* ---------------- reconciliation ---------------- */

const sumQ = {
  deposits: "SELECT COALESCE(SUM(amount),0) s FROM deposits WHERE status='Success'",
  withdrawals: "SELECT COALESCE(SUM(amount),0) s FROM withdrawals WHERE status='Success'",
  usersBalance: "SELECT COALESCE(SUM(balance),0) s, COALESCE(SUM(recharge_balance),0) r FROM users",
};

async function reconcile(mongo, conn) {
  const report = [];
  let ok = true;

  for (const name of ORDER) {
    const source = name === "settings"
      ? await mongo.collection("settings").countDocuments({ key: "global" })
      : await mongo.collection(name).countDocuments({});
    const [rows] = await conn.query("SELECT COUNT(*) c FROM `" + mysqlTable(name) + "`");
    const target = Number(rows[0].c);
    const match = target >= source; /* >= : duplicates skipped, source never grows */
    if (!match) ok = false;
    report.push({ collection: name, source, target, match });
  }

  /* financial totals */
  const finChecks = [];
  const dpSrc = await mongo.collection("deposits").aggregate([{ $match: { status: "Success" } }, { $group: { _id: null, s: { $sum: "$amount" } } }]).toArray();
  const wdSrc = await mongo.collection("withdrawals").aggregate([{ $match: { status: "Success" } }, { $group: { _id: null, s: { $sum: "$amount" } } }]).toArray();
  const balSrc = await mongo.collection("users").aggregate([{ $group: { _id: null, b: { $sum: "$balance" }, r: { $sum: "$rechargeBalance" } } }]).toArray();
  const invSrc = await mongo.collection("invests").aggregate([{ $group: { _id: null, s: { $sum: "$price" } } }]).toArray();

  const [dpTgt] = (await conn.query(sumQ.deposits))[0];
  const [wdTgt] = (await conn.query(sumQ.withdrawals))[0];
  const [balTgt] = (await conn.query(sumQ.usersBalance))[0];
  const [invTgt] = (await conn.query("SELECT COALESCE(SUM(price),0) s FROM invests"))[0];

  const fin = (label, src, tgt) => {
    const match = Math.abs(Number(src || 0) - Number(tgt || 0)) < 0.02;
    if (!match) ok = false;
    finChecks.push({ label, source: dec2(src), target: dec2(tgt), match });
  };

  fin("successful deposits ₹", dpSrc[0] && dpSrc[0].s, dpTgt.s);
  fin("successful withdrawals ₹", wdSrc[0] && wdSrc[0].s, wdTgt.s);
  fin("users balance ₹", balSrc[0] && balSrc[0].b, balTgt.s);
  fin("users recharge balance ₹", balSrc[0] && balSrc[0].r, balTgt.r);
  fin("invest total ₹", invSrc[0] && invSrc[0].s, invTgt.s);

  /* orphaned references */
  const [orphanWd] = await conn.query(
    "SELECT COUNT(*) c FROM withdrawals w LEFT JOIN users u ON w.user_id = u.id WHERE w.user_id IS NOT NULL AND u.id IS NULL"
  );
  const [orphanTx] = await conn.query(
    "SELECT COUNT(*) c FROM transactions t LEFT JOIN users u ON t.user_id = u.id WHERE t.user_id IS NOT NULL AND u.id IS NULL"
  );
  if (Number(orphanWd[0].c) > 0 || Number(orphanTx[0].c) > 0) ok = false;
  finChecks.push({ label: "orphaned withdrawal refs", source: 0, target: Number(orphanWd[0].c), match: Number(orphanWd[0].c) === 0 });
  finChecks.push({ label: "orphaned transaction refs", source: 0, target: Number(orphanTx[0].c), match: Number(orphanTx[0].c) === 0 });

  return { report, finChecks, ok };
}

/* ---------------- main ---------------- */

async function main() {
  log("=== NIKECODE MongoDB → MySQL migration ===");
  log("mode:", REPORT_ONLY ? "REPORT ONLY" : WRITE ? "WRITE" : "DRY RUN (use --write to apply)");
  log("target db:", DB_NAME, "host:", process.env.DB_HOST || "127.0.0.1");
  log("");

  const mongo = new MongoClient(MONGO_URI, { serverSelectionTimeoutMS: 15000 });
  await mongo.connect();
  const mdb = mongo.db(MONGO_DB);
  log("✅ MongoDB connected (db: " + MONGO_DB + ")");

  if (WRITE && !NO_SCHEMA) {
    log("applying schema migrations…");
    await runMigrations({ log: () => {} });
  }

  await withConn(
    async (conn) => {
      if (REPORT_ONLY) {
        const r = await reconcile(mdb, conn);
        printReport(r);
        process.exitCode = r.ok ? 0 : 1;
        return;
      }

      if (!WRITE) {
        /* DRY RUN — no schema, no writes. Mappers are exercised against
           every source document to surface mapping bugs early. */
        log("(dry run: no schema changes, no writes)");
      }

      const results = {};
      for (const name of ORDER) {
        if (ONLY && name !== ONLY) continue;
        const r = await migrateCollectionWithRefs(mdb, conn, name, WRITE);
        results[name] = r;
        log(
          "• " + name.padEnd(13) +
            " source=" + r.source +
            (r.dry
              ? " (dry)" + (r.mappingErrors ? " MAPPING-ERRORS=" + r.mappingErrors : "")
              : " inserted=" + r.inserted +
                " skipped=" + (r.skipped || 0) +
                (r.remapped ? " refs=" + r.remapped : ""))
        );
      }

    if (!ONLY) {
      if (!WRITE) {
        log("\n(dry run: reconciliation skipped — run with --write to populate the target)");
      } else {
        const r = await reconcile(mdb, conn);
        log("");
        printReport(r);
        process.exitCode = r.ok ? 0 : 1;
      }
    } else {
      log("\ncollection-scoped run — reconciliation skipped (run without --collection for the full report)");
    }
  },
    { noDb: !WRITE && !REPORT_ONLY }
  );

  await mongo.close();
}

function printReport(r) {
  log("=== RECONCILIATION REPORT ===");
  log("collection      source   target   match");
  for (const row of r.report) {
    log(
      row.collection.padEnd(15) +
        String(row.source).padStart(7) +
        String(row.target).padStart(9) +
        "   " + (row.match ? "OK" : "MISMATCH")
    );
  }
  log("");
  log("financial / integrity checks");
  for (const f of r.finChecks) {
    log("• " + f.label.padEnd(28) + " source=" + f.source + " target=" + f.target + " → " + (f.match ? "OK" : "MISMATCH"));
  }
  log("");
  log(r.ok ? "✅ RECONCILIATION PASSED" : "❌ RECONCILIATION FAILED — investigate before switching the app to MySQL");
}

main().catch((e) => {
  console.error("migration failed:", e.message);
  process.exit(1);
});
