/* ============================================================
   TEST HARNESS — isolated MongoDB (mongodb-memory-server) +
   a minimal Express assembly mirroring server.js's middleware
   stack. No production database, no real gateway network: the
   gateway is mocked with a local http server.

   Each test file runs in its own node:test process and gets a
   fresh memory DB + fresh app. Collections are wiped between
   tests — the memory instance is dropped with the process.
   ============================================================ */

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret-do-not-use-in-prod-0123456789abcdef";

const { MongoMemoryServer } = require("mongodb-memory-server");
const mongoose = require("mongoose");
const express = require("express");
const http = require("http");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");

let mongod = null;

/* boot the memory mongo + mongoose connection (once per file) */
async function startDb() {
  mongod = await MongoMemoryServer.create({ instance: { dbName: "zapto_test" } });
  await mongoose.connect(mongod.getUri("zapto_test"), {
    serverSelectionTimeoutMS: 20000,
  });
  return mongod;
}

async function stopDb() {
  try {
    await mongoose.disconnect();
  } catch (e) {}
  try {
    if (mongod) await mongod.stop();
  } catch (e) {}
}

/* wipe every collection between tests (test DB only) */
async function cleanDb() {
  const { models } = mongoose;
  for (const name of Object.keys(models)) {
    await models[name].deleteMany({}).exec();
  }
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
const User = require("../models/User");
const Plan = require("../models/Plan");
const Deposit = require("../models/Deposit");
const Withdrawal = require("../models/Withdrawal");
const Setting = require("../models/Setting");
const Transaction = require("../models/Transaction");
const Admin = require("../models/Admin");
const LoginCode = require("../models/LoginCode");

const QWACK_KEY = "qwack-test-key";
const OKPAY_KEY = "okpay-test-key";

/* seed the global settings doc + gateway credentials used by the tests */
async function seedSettings(overrides = {}) {
  await Setting.create({
    key: "global",
    qwackpay: {
      enabled: true,
      merchantId: "M123",
      apiKey: QWACK_KEY,
      baseUrl: overrides.qwackBaseUrl || "https://qwackpay.invalid/api/v1",
    },
    okpay: {
      enabled: true,
      mchId: "M456",
      apiKey: OKPAY_KEY,
      baseUrl: "https://okpay.invalid",
    },
    recharge: { minAmount: 0, maxAmount: 0 },
    withdraw: { minAmount: 130, maxAmount: 0, chargePercent: 10, enabled: true },
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
};
