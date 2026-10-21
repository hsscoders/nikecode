/* ============================================================
   TEST HARNESS — MySQL edition.
   Runs against a disposable MySQL database (nikecode_test) on the
   local test server (see /home/z/my-project/scripts/boot-mysql.sh):
     DB_HOST=127.0.0.1, DB_PORT=3307, user `app`
   Override with TEST_DB_* env vars if needed.
   Schema comes from db/migrations (same SQL as production); tables
   are truncated between tests. No production database is touched.
   ============================================================ */

/* env BEFORE any model/db require — the Sequelize singleton reads them */
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret-do-not-use-in-prod-0123456789abcdef";
process.env.DB_NAME = process.env.TEST_DB_NAME || "nikecode_test";
process.env.DB_HOST = process.env.TEST_DB_HOST || "127.0.0.1";
process.env.DB_PORT = process.env.TEST_DB_PORT || "3307";
process.env.DB_USER = process.env.TEST_DB_USER || "app";
process.env.DB_PASSWORD = process.env.TEST_DB_PASSWORD || "apppass123";
process.env.DB_POOL_MAX = "5";

const mysql = require("mysql2/promise");
const express = require("express");
const http = require("http");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");

/* ---- domain models (db/index singleton created with the env above) ---- */
const { sequelize, Sequelize } = require("../db");
const User = require("../models/User");
const Plan = require("../models/Plan");
const Deposit = require("../models/Deposit");
const Withdrawal = require("../models/Withdrawal");
const Setting = require("../models/Setting");
const Transaction = require("../models/Transaction");
const Admin = require("../models/Admin");
const LoginCode = require("../models/LoginCode");
const Invest = require("../models/Invest");
const AuditLog = require("../models/AuditLog");
const { runMigrations } = require("../db/migrate");

const QWACK_KEY = "qwack-test-key";
const OKPAY_KEY = "okpay-test-key";

const ALL_TABLES = [
  "login_codes",
  "audit_logs",
  "transactions",
  "invests",
  "withdrawals",
  "deposits",
  "banners",
  "plans",
  "users",
  "admins",
  "settings",
];

/* boot: recreate the test database + apply migrations */
async function startDb() {
  const boot = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  });
  await boot.query("DROP DATABASE IF EXISTS `" + process.env.DB_NAME + "`");
  await boot.query("CREATE DATABASE `" + process.env.DB_NAME + "` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
  await boot.end();
  await runMigrations({ log: () => {} });
  await sequelize.authenticate();
}

/* wipe every table between tests (test DB only) */
async function cleanDb() {
  await sequelize.query("SET FOREIGN_KEY_CHECKS = 0");
  for (const t of ALL_TABLES) {
    await sequelize.query("TRUNCATE TABLE `" + t + "`");
  }
  await sequelize.query("SET FOREIGN_KEY_CHECKS = 1");
  /* TRUNCATE resets AUTO_INCREMENT → new users reuse id 1 → the in-memory
     rate-limit buckets must be cleared or tests inherit each other's counts */
  require("../middleware/rateLimit")._resetForTests();
}

async function stopDb() {
  try {
    await sequelize.close();
  } catch (e) {}
}

/* Express app assembled exactly like server.js does (same parsers,
   same route mounts) — but WITHOUT listening (http helper below). */
function buildApp() {
  const app = express();
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: true }));
  app.use("/api/auth", require("../routes/auth"));
  app.use("/api/admin/auth", require("../routes/adminAuth"));
  app.use("/api/admin", require("../routes/admin"));
  app.use("/api", require("../routes/wallet"));
  app.use("/api/payments", require("../routes/payments"));
  app.use("/api", (req, res) =>
    res.status(404).json({ success: false, message: "API route not found" })
  );
  return app;
}

/* ephemeral http server for fetch()-based tests */
async function listen(app) {
  const server = http.createServer(app);
  await new Promise((res) => server.listen(0, "127.0.0.1", res));
  const base = "http://127.0.0.1:" + server.address().port;
  return { server, base };
}

/* tiny JSON fetch helper */
async function call(base, method, path, { token, body, form } = {}) {
  const headers = {};
  let payload;
  if (form) {
    headers["Content-Type"] = "application/x-www-form-urlencoded";
    payload = new URLSearchParams(form).toString();
  } else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }
  if (token) headers["Authorization"] = "Bearer " + token;
  const res = await fetch(base + path, {
    method,
    headers,
    body: payload,
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch (e) {}
  return { status: res.status, json, text };
}

/* ---- gateway signature helpers (mirror the services exactly) ---- */
function qwackSign(params, apiKey) {
  const signStr =
    Object.entries(params)
      .filter(([k, v]) => k !== "sign" && v !== "" && v !== null && v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([k, v]) => `${k}=${typeof v === "object" ? JSON.stringify(v) : v}`)
      .join("&") + `&key=${apiKey}`;
  return crypto.createHash("md5").update(signStr, "utf8").digest("hex").toUpperCase();
}

function okpaySign(params, apiKey) {
  const signStr =
    Object.entries(params)
      .filter(([k, v]) => k !== "sign" && v !== "" && v !== null && v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([k, v]) => `${k}=${v}`)
      .join("&") + `&key=${apiKey}`;
  return crypto.createHash("md5").update(signStr, "utf8").digest("hex").toLowerCase();
}

/* ---- domain fixtures ---- */

/* seed the global settings doc + gateway credentials used by the tests */
async function seedSettings(overrides = {}) {
  await Setting.saveGlobal({
    ...Setting.DEFAULTS,
    qwackpay: {
      ...Setting.DEFAULTS.qwackpay,
      enabled: true,
      merchantId: "M123",
      apiKey: QWACK_KEY,
      baseUrl: overrides.qwackBaseUrl || "https://qwackpay.invalid/api/v1",
    },
    okpay: {
      ...Setting.DEFAULTS.okpay,
      enabled: true,
      mchId: "M456",
      apiKey: OKPAY_KEY,
      baseUrl: "https://okpay.invalid",
    },
    recharge: { ...Setting.DEFAULTS.recharge, minAmount: 0, maxAmount: 0 },
    withdraw: { ...Setting.DEFAULTS.withdraw, minAmount: 130, maxAmount: 0, chargePercent: 10, enabled: true },
    ...(overrides.settingFields || {}),
  });
}

/* create a user straight in the DB (bypasses rate limits) */
async function mkUser({ phone, balance = 0, rechargeBalance = 0, refBy = "", refId = "" } = {}) {
  return User.create({
    phone,
    password: await bcrypt.hash("loginpass", 10),
    withdrawPassword: await bcrypt.hash("wdpass", 10),
    userid: "ZP" + Math.floor(100000 + Math.random() * 900000),
    refId: refId || "ZPR" + crypto.randomBytes(4).toString("hex").toUpperCase(),
    refBy,
    balance,
    rechargeBalance,
  });
}

/* register through the API (returns token) — used in auth tests */
async function apiRegister(base, phone, extra = {}) {
  const r = await call(base, "POST", "/api/auth/register", {
    body: {
      phone,
      password: "loginpass",
      password_confirmation: "loginpass",
      withdraw_password: "wdpass1",
      ...extra,
    },
  });
  return r;
}

module.exports = {
  startDb,
  stopDb,
  cleanDb,
  buildApp,
  listen,
  call,
  qwackSign,
  okpaySign,
  seedSettings,
  mkUser,
  apiRegister,
  QWACK_KEY,
  OKPAY_KEY,
  Sequelize,
};
