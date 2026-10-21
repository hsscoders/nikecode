const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const http = require("http");
const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const { live } = require("./live");
const { sequelize, Sequelize, inc } = require("./db");
const { authRateLimit, moneyRateLimit } = require("./middleware/rateLimit");
const authRoutes = require("./routes/auth");
const adminAuthRoutes = require("./routes/adminAuth");
const adminRoutes = require("./routes/admin");
const publicRoutes = require("./routes/public");
const walletRoutes = require("./routes/wallet");
const paymentsRoutes = require("./routes/payments");
const Admin = require("./models/Admin");
const Setting = require("./models/Setting");
const Plan = require("./models/Plan");
const Banner = require("./models/Banner");
const Invest = require("./models/Invest");
const User = require("./models/User");
const Transaction = require("./models/Transaction");
const AuditLog = require("./models/AuditLog");
const { emitToUser } = require("./live");

const app = express();

/* Public-URL auto-detection: trust the X-Forwarded-* headers from the
   reverse-proxy chain (nginx / Next.js rewrites) so req.protocol + host
   reflect the PUBLIC origin the browser used — this is what gateway
   webhook notify_url and the payment return_url are built from. */
app.set("trust proxy", true);

/* Security hardening — hide the framework banner, stop MIME sniffing,
   never leak referrer URLs to third-party hosts. Cheap no-op headers,
   applied to every response before any route runs. */
app.disable("x-powered-by");
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  next();
});

/* ============ SOCKET.IO (realtime updates) ============
   Client/admin connect through the Next.js rewrite proxy
   (/api/socket.io -> backend). Transport: long-polling first, the
   upgrade to websocket is attempted automatically when possible. */

/* Allowed browser origins — comma-separated list in backend/.env
   (CORS_ORIGINS=https://domain.com,https://www.domain.com).
   Empty/unset = allow all (local development). Requests without an
   Origin header (curl, payment webhooks, server-to-server) pass anyway. */
const CORS_ORIGINS = String(process.env.CORS_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const corsOriginCheck = (origin, cb) => {
  if (!origin || CORS_ORIGINS.length === 0 || CORS_ORIGINS.includes(origin))
    return cb(null, true);
  return cb(null, false);
};

const server = http.createServer(app);
const io = new Server(server, {
  path: "/api/socket.io",
  addTrailingSlash: false, /* Next.js rewrite 308-strips the trailing slash */
  cors: { origin: corsOriginCheck, credentials: true },
  pingInterval: 25000,
  pingTimeout: 60000,
});
live.io = io;

/* Socket auth — one JWT secret for both; admin tokens carry role: "admin".
   Users join their own room (wallet pushes), admins join the admins room. */
io.use((socket, next) => {
  try {
    const token = socket.handshake.auth && socket.handshake.auth.token;
    if (!token) return next(); /* anonymous sockets are allowed but receive nothing */
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role === "admin") socket.data.admin = true;
    else socket.data.phone = decoded.phone || "";
  } catch (e) {}
  next();
});

io.on("connection", (socket) => {
  if (socket.data.phone) socket.join("user:" + socket.data.phone);
  if (socket.data.admin) socket.join("admins");
});

/* Admin uploads — route-specific parser for large base64 payloads
   (mounted before the global 100kb json limit, otherwise 413).
   Files are stored locally in backend/public/uploads (ImgBB removed). */
app.use("/api/admin/upload", express.json({ limit: "36mb" }));

app.use(cors({ origin: corsOriginCheck, credentials: true }));
app.use(express.json());
/* OKPay (wpay.one) posts its payin/payout callbacks as
   application/x-www-form-urlencoded — without this parser req.body is empty
   and the webhook signature check fails. JSON routes are unaffected. */
app.use(express.urlencoded({ extended: true }));

/* Banner/asset static serve (backend/public) */
app.use(express.static(path.join(__dirname, "public")));

// Health check
app.get("/api/health", (req, res) => res.json({ ok: true, service: "zapto-api", db: "mysql" }));

// Auth routes — rate-limited (per-IP burst + per-phone brute-force lock)
app.use("/api/auth", authRateLimit, authRoutes);

// Admin auth (login)
app.use("/api/admin/auth", adminAuthRoutes);

// Admin panel (protected)
app.use("/api/admin", adminRoutes);

// Public content (plans/banners/settings) + user wallet actions
app.use("/api", publicRoutes);
app.use("/api", walletRoutes);

// QwackPay auto-gateway (create order / webhook notify / status poll)
// NOTE: no limiter at mount level — the webhook notify routes are
// unauthenticated and must stay reachable for gateway retries. The
// authenticated create/status routes apply moneyRateLimit individually.
app.use("/api/payments", paymentsRoutes);

// 404 fallback for unknown api routes
app.use("/api", (req, res) =>
  res.status(404).json({ success: false, message: "API route not found" })
);

/* Global error handler — keeps internal details (stack, driver errors) out
   of API responses in production while logging them server-side. */
app.use((err, req, res, _next) => {
  const status = err && err.status ? err.status : 500;
  console.error("API error:", req.method, req.originalUrl, "-", err.message);
  if (status >= 500) console.error(err.stack || err);
  if (res.headersSent) return;
  res.status(status).json({
    success: false,
    message: status >= 500 ? "Internal server error" : err.message,
  });
});

const PORT = process.env.PORT || 3030;

if (!process.env.DB_NAME || !process.env.DB_USER) {
  console.error("❌ DB_NAME / DB_USER missing in backend/.env");
  process.exit(1);
}
if (!process.env.JWT_SECRET) {
  console.error("❌ JWT_SECRET missing in backend/.env");
  process.exit(1);
}

/* ============ SEED (default data on first run) ============ */
async function seed() {
  try {
    if ((await Admin.count()) === 0) {
      await Admin.create({
        username: "admin",
        password: await bcrypt.hash("admin123", 10),
        name: "Super Admin",
      });
      console.log("✅ Seed: admin created (admin / admin123)");
    }
    if ((await Setting.count()) === 0) {
      /* full schema defaults — getGlobal() deep-merges over them anyway */
      await Setting.saveGlobal(Setting.DEFAULTS);
      console.log("✅ Seed: global settings created");
    }
    if ((await Plan.count()) === 0) {
      await Plan.bulkCreate([
        { name: "Starter Plan", vip: false, price: 530, daily: 63.6, cycle: 10, total: 636, limit: 1, sort: 1 },
        { name: "Silver Plan", vip: false, price: 1100, daily: 137.5, cycle: 12, total: 1650, limit: 2, sort: 2 },
        { name: "Gold Plan", vip: false, price: 2500, daily: 266.67, cycle: 15, total: 4000, limit: 3, sort: 3 },
        { name: "VIP Platinum", vip: true, price: 5500, daily: 700, cycle: 12, total: 8400, limit: 1, sort: 4 },
        { name: "VIP Diamond", vip: true, price: 11000, daily: 1550, cycle: 15, total: 23250, limit: 1, presale: true, sort: 5 },
      ]);
      console.log("✅ Seed: default plans created");
    }
    if ((await Banner.count()) === 0) {
      await Banner.bulkCreate([
        { title: "Saudi Aramco Banner 1", image: "/banners/aramco-banner.png", active: true, sort: 1 },
        { title: "Saudi Aramco Banner 2", image: "/banners/zapto-banner-2.png", active: true, sort: 2 },
      ]);
      console.log("✅ Seed: default banners created");
    }

    /* self-heal — legacy rows (pre-migration Mongo data) may predate newer
       fields; the JSON settings merge covers settings, this covers invests */
    await Invest.update({ paidDays: 0 }, { where: { paidDays: null } });
  } catch (e) {
    console.error("seed error:", e.message);
  }
}

/* ============ DAILY PLAN INCOME AUTO-CREDIT (admin-set time, IST) ============
   Every active plan pays its daily income once a day. The admin picks the
   credit time (HH:MM IST) in Admin → Settings → Income Time.            */
const istTime = () =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date()); // "HH:MM"

const istToday = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date()); // "YYYY-MM-DD"

async function runIncomeCredit() {
  /* self-heal — plans whose paidDays already reached the cycle but whose
     status never flipped are closed here so they stop counting towards the
     daily liability stats */
  await Invest.update(
    { status: "Completed" },
    { where: { status: "Active", paidDays: { [Sequelize.Op.gte]: sequelize.col("cycle") } } }
  );

  const invests = await Invest.findAll({
    where: {
      status: "Active",
      paidDays: { [Sequelize.Op.lt]: sequelize.col("cycle") },
    },
  });

  let paid = 0;
  for (const inv of invests) {
    const prevPaid = Number(inv.paidDays) || 0;
    /* atomic claim on the EXACT previous paidDays value — the filter only
       matches while paidDays is still prevPaid, so two overlapping runs can
       never both win. The winner makes dayNo unique: the ledger can never
       repeat "Day N" for a plan. */
    const [claim] = await Invest.update(
      { paidDays: inc("paid_days", 1) },
      { where: { id: inv.id, status: "Active", paidDays: prevPaid } }
    );
    if (claim === 0) continue;

    const dayNo = prevPaid + 1;
    await User.update(
      { balance: inc("balance", inv.daily), totalIncome: inc("total_income", inv.daily) },
      { where: { id: inv.user } }
    );
    await Transaction.create({
      user: inv.user,
      userid: inv.userid || "",
      phone: inv.phone || "",
      type: "income",
      title: "Daily Income",
      method: inv.planName + " (Day " + dayNo + "/" + inv.cycle + ")",
      amount: inv.daily,
      status: "Success",
    });
    /* realtime — push the new balance to the user's open tabs */
    emitToUser(inv.phone, "wallet:refresh", { reason: "income" });
    if (dayNo >= Number(inv.cycle))
      await Invest.update({ status: "Completed" }, { where: { id: inv.id } });
    paid++;
  }
  console.log("✅ Income credit: " + paid + " plan(s) paid at " + istTime() + " IST");
}

/* one daily audit-trail prune (the old MongoDB TTL index did this) */
let lastPruneDay = "";
async function pruneAudit() {
  const today = istToday();
  if (lastPruneDay === today) return;
  lastPruneDay = today;
  try {
    const n = await AuditLog.destroy({
      where: {
        createdAt: { [Sequelize.Op.lt]: new Date(Date.now() - 90 * 864e5) },
      },
    });
    if (n) console.log("🗑️ audit prune: removed " + n + " row(s) older than 90 days");
  } catch (e) {
    console.error("audit prune error:", e.message);
  }
}

async function incomeCronTick() {
  try {
    /* atomic claim — only the first tick inside the matching minute wins.
       The guarded JSON_SET performs the date flip + claim in ONE statement,
       exactly like the old Mongoose updateOne claim did. */
    const [result] = await sequelize.query(
      "UPDATE settings " +
        "SET data = JSON_SET(data, '$.income.lastCreditDate', :today) " +
        "WHERE `key` = 'global' " +
        "AND JSON_UNQUOTE(JSON_EXTRACT(data, '$.income.creditTime')) = :nowIst " +
        "AND (JSON_EXTRACT(data, '$.income.lastCreditDate') IS NULL " +
        "     OR JSON_UNQUOTE(JSON_EXTRACT(data, '$.income.lastCreditDate')) <> :today)",
      {
        replacements: { today: istToday(), nowIst: istTime() },
        type: sequelize.QueryTypes.UPDATE,
      }
    );
    if (result && result.affectedRows === 1) await runIncomeCredit();
    await pruneAudit();
  } catch (e) {
    console.error("income cron error:", e.message);
  }
}

/* ============ BOOT ============ */
async function start() {
  await sequelize.authenticate();
  console.log("✅ MySQL connected (" + sequelize.config.database + ")");
  await seed();
  /* daily income scheduler — checks every 15s against the admin-set time */
  setInterval(incomeCronTick, 15 * 1000);

  server.listen(PORT, () =>
    console.log("🚀 ZAPTO API ready on :" + PORT + " (socket.io on /api/socket.io, db: mysql)")
  );
}

start().catch((err) => {
  console.error("❌ MySQL connection failed:", err.message);
  process.exit(1);
});

/* ============ GRACEFUL SHUTDOWN (cPanel / Passenger restarts) ============
   Passenger sends SIGTERM on redeploy — finish in-flight requests, close
   MySQL cleanly, then exit so the replacement process starts fresh. */
function shutdown(signal) {
  console.log("\n" + signal + " received — shutting down gracefully…");
  server.close(() => {
    sequelize
      .close()
      .catch(() => {})
      .finally(() => process.exit(0));
  });
  /* hard exit if something hangs — Passenger will restart us anyway */
  setTimeout(() => process.exit(0), 10000).unref();
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("unhandledRejection", (reason) =>
  console.error("unhandledRejection:", reason && reason.message ? reason.message : reason)
);
