const router = require("express").Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const Admin = require("../models/Admin");
const { authRateLimit } = require("../middleware/rateLimit");
const audit = require("../services/audit");

/* ============ ADMIN LOGIN ============
   Rate-limited like the user auth routes (per-IP burst + per-identity
   lockout — the identity here is the username) and fully audited: every
   attempt, success or fail, lands in the activity trail. */
router.post("/login", authRateLimit, async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password)
      return res
        .status(400)
        .json({ success: false, message: "Enter username and password" });

    const admin = await Admin.findOne({
      where: { username: String(username).trim().toLowerCase() },
    });
    if (!admin) {
      audit.log(req, {
        actorType: "system",
        action: "admin.login_failed",
        category: "auth",
        target: String(username).slice(0, 60),
        message: "Failed admin login — unknown username",
      });
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }

    const ok = await bcrypt.compare(String(password), admin.password);
    if (!ok) {
      audit.log(req, {
        actorType: "system",
        action: "admin.login_failed",
        category: "auth",
        target: admin.username,
        message: "Failed admin login — wrong password",
      });
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }

    const token = jwt.sign(
      { id: admin.id, role: "admin" },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    audit.log(req, {
      actorType: "admin",
      actor: { id: admin.id, label: admin.username },
      action: "admin.login",
      category: "auth",
      target: admin.username,
      message: "Admin signed in to the panel",
    });

    res.json({
      success: true,
      message: "Login successful",
      token,
      admin: { name: admin.name, username: admin.username },
    });
  } catch (e) {
    console.error("admin login error:", e.message);
    res.status(500).json({ success: false, message: "Server error, please try again" });
  }
});

module.exports = router;
