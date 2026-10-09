const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const authRoutes = require("./routes/auth");

const app = express();

app.use(cors());
app.use(express.json());

// Health check
app.get("/api/health", (req, res) => res.json({ ok: true, service: "zapto-api" }));

// Auth routes
app.use("/api/auth", authRoutes);

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

mongoose
  .connect(MONGO_URI, { dbName: "zapto", serverSelectionTimeoutMS: 15000 })
  .then(() => console.log("✅ MongoDB connected (db: zapto)"))
  .catch((err) => {
    console.error("❌ MongoDB connection failed:", err.message);
    process.exit(1);
  });

app.listen(PORT, () => console.log(`🚀 ZAPTO API ready on :${PORT}`));
