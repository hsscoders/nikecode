const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const authRoutes = require("./routes/auth");
const adminAuthRoutes = require("./routes/adminAuth");
const adminRoutes = require("./routes/admin");
const publicRoutes = require("./routes/public");
const walletRoutes = require("./routes/wallet");
const Admin = require("./models/Admin");
const Setting = require("./models/Setting");
const Plan = require("./models/Plan");
const Banner = require("./models/Banner");

const app = express();

/* ImgBB upload — bade base64 payload ke liye route-specific parser
   (global 100kb json limit se pehle mount, warna 413 aa jata) */
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

/* ============ SEED (first run par default data) ============ */
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
        { title: "ZAPTO Banner 1", image: "/banners/zapto-banner.png", active: true, sort: 1 },
        { title: "ZAPTO Banner 2", image: "/banners/zapto-banner-2.png", active: true, sort: 2 },
      ]);
      console.log("✅ Seed: default banners created");
    }
  } catch (e) {
    console.error("seed error:", e.message);
  }
}

mongoose
  .connect(MONGO_URI, { dbName: "zapto", serverSelectionTimeoutMS: 15000 })
  .then(() => {
    console.log("✅ MongoDB connected (db: zapto)");
    seed();
  })
  .catch((err) => {
    console.error("❌ MongoDB connection failed:", err.message);
    process.exit(1);
  });

app.listen(PORT, () => console.log(`🚀 ZAPTO API ready on :${PORT}`));
