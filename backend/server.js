const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const http = require("http");
const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const { live } = require("./live");
const authRoutes = require("./routes/auth");
const adminAuthRoutes = require("./routes/adminAuth");
const adminRoutes = require("./routes/admin");
const publicRoutes = require("./routes/public");
const walletRoutes = require("./routes/wallet");
const Admin = require("./models/Admin");
const Setting = require("./models/Setting");
const Plan = require("./models/Plan");
const Banner = require("./models/Banner");
const Invest = require("./models/Invest");
const User = require("./models/User");
const Transaction = require("./models/Transaction");
const { emitToUser } = require("./live");

const app = express();

/* ============ SOCKET.IO (realtime updates) ============
   Client/admin connect through the Next.js rewrite proxy
   (/api/socket.io -> backend). Transport: long-polling first, the
   upgrade to websocket is attempted automatically when possible. */
const server = http.createServer(app);
const io = new Server(server, {
  path: "/api/socket.io",
  addTrailingSlash: false, /* Next.js rewrite 308-strips the trailing slash */
  cors: { origin: true, credentials: true },
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

app.use(cors());
app.use(express.json());

/* Banner/asset static serve (backend/public) */
app.use(express.static(path.join(__dirname, "public")));

// Health check
app.get("/api/health", (req, res) => res.json({ ok: true, service: "zapto-api" }));

// Auth routes
app.use("/api/auth", authRoutes);

// Admin auth (login)
app.use("/api/admin/auth", adminAuthRoutes);

// Admin panel (protected)
app.use("/api/admin", adminRoutes);

// Public content (plans/banners/settings) + user wallet actions
app.use("/api", publicRoutes);
app.use("/api", walletRoutes);

// 404 fallback for unknown api routes
app.use("/api", (req, res) =>
  res.status(404).json({ success: false, message: "API route not found" })
);

const PORT = process.env.PORT || 3030;
const MONGO_URI = process.env.MONGODB_URI;

if (!MONGO_URI) {
  console.error("❌ MONGODB_URI missing in backend/.env");
  process.exit(1);
}

/* ============ SEED (default data on first run) ============ */
async function seed() {
  try {
    if ((await Admin.countDocuments({})) === 0) {
      await Admin.create({
        username: "admin",
        password: await bcrypt.hash("admin123", 10),
        name: "Super Admin",
      });
      console.log("✅ Seed: admin created (admin / admin123)");
    }
    if ((await Setting.countDocuments({ key: "global" })) === 0) {
      await Setting.create({ key: "global" });
      console.log("✅ Seed: global settings created");
    }
    if ((await Plan.countDocuments({})) === 0) {
      await Plan.insertMany([
        { name: "Starter Plan", vip: false, price: 530, daily: 63.6, cycle: 10, total: 636, limit: 1, sort: 1 },
        { name: "Silver Plan", vip: false, price: 1100, daily: 137.5, cycle: 12, total: 1650, limit: 2, sort: 2 },
        { name: "Gold Plan", vip: false, price: 2500, daily: 266.67, cycle: 15, total: 4000, limit: 3, sort: 3 },
        { name: "VIP Platinum", vip: true, price: 5500, daily: 700, cycle: 12, total: 8400, limit: 1, sort: 4 },
        { name: "VIP Diamond", vip: true, price: 11000, daily: 1550, cycle: 15, total: 23250, limit: 1, presale: true, sort: 5 },
      ]);
      console.log("✅ Seed: default plans created");
    }
    if ((await Banner.countDocuments({})) === 0) {
      await Banner.insertMany([
        { title: "Saudi Aramco Banner 1", image: "/banners/aramco-banner.png", active: true, sort: 1 },
        { title: "Saudi Aramco Banner 2", image: "/banners/zapto-banner-2.png", active: true, sort: 2 },
      ]);
      console.log("✅ Seed: default banners created");
    }

    /* Migrations — make sure older documents get the new fields */
    await Setting.updateOne(
      { key: "global", income: { $exists: false } },
      { $set: { income: { creditTime: "00:00", lastCreditDate: "" } } }
    );
    await Setting.updateOne(
      { key: "global", appearance: { $exists: false } },
      { $set: { appearance: { preset: "maroon", primary: "#7c1d33", accent: "#d4a94f", fontHead: "playfair", fontBody: "inter" } } }
    );
    await Invest.updateMany(
      { paidDays: { $exists: false } },
      { $set: { paidDays: 0 } }
    );
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
  const invests = await Invest.find({
    status: "Active",
    $expr: { $lt: [{ $ifNull: ["$paidDays", 0] }, "$cycle"] },
  }).lean();

  let paid = 0;
  for (const inv of invests) {
    /* atomic per-plan claim — the same day can never pay a plan twice */
    const upd = await Invest.updateOne(
      { _id: inv._id, status: "Active", $expr: { $lt: [{ $ifNull: ["$paidDays", 0] }, "$cycle"] } },
      { $inc: { paidDays: 1 } }
    );
    if (!upd.modifiedCount) continue;

    const dayNo = (Number(inv.paidDays) || 0) + 1;
    await User.updateOne(
      { _id: inv.user },
      { $inc: { balance: inv.daily, totalIncome: inv.daily } }
    );
    await Transaction.create({
      user: inv.user,
      userid: inv.userid || "",
      phone: inv.phone || "",
      type: "income",
      title: "Daily income — " + inv.planName + " (Day " + dayNo + "/" + inv.cycle + ")",
      amount: inv.daily,
      status: "Success",
    });
    /* realtime — push the new balance to the user's open tabs */
    emitToUser(inv.phone, "wallet:refresh", { reason: "income" });
    if (dayNo >= Number(inv.cycle))
      await Invest.updateOne({ _id: inv._id }, { status: "Completed" });
    paid++;
  }
  console.log("✅ Income credit: " + paid + " plan(s) paid at " + istTime() + " IST");
}

async function incomeCronTick() {
  try {
    /* atomic claim — only the first tick inside the matching minute wins */
    const claim = await Setting.updateOne(
      {
        key: "global",
        "income.creditTime": istTime(),
        "income.lastCreditDate": { $ne: istToday() },
      },
      { $set: { "income.lastCreditDate": istToday() } }
    );
    if (claim.modifiedCount === 1) await runIncomeCredit();
  } catch (e) {
    console.error("income cron error:", e.message);
  }
}

mongoose
  .connect(MONGO_URI, { dbName: "zapto", serverSelectionTimeoutMS: 15000 })
  .then(() => {
    console.log("✅ MongoDB connected (db: zapto)");
    seed();
    /* daily income scheduler — checks every 15s against the admin-set time */
    setInterval(incomeCronTick, 15 * 1000);
  })
  .catch((err) => {
    console.error("❌ MongoDB connection failed:", err.message);
    process.exit(1);
  });

server.listen(PORT, () => console.log(`🚀 ZAPTO API ready on :${PORT} (socket.io on /api/socket.io)`));
