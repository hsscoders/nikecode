const router = require("express").Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const Admin = require("../models/Admin");

/* ============ ADMIN LOGIN ============ */
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password)
      return res
        .status(400)
        .json({ success: false, message: "Enter username and password" });

    const admin = await Admin.findOne({
      username: String(username).trim().toLowerCase(),
    });
    if (!admin)
      return res.status(401).json({ success: false, message: "Invalid credentials" });

    const ok = await bcrypt.compare(String(password), admin.password);
    if (!ok)
      return res.status(401).json({ success: false, message: "Invalid credentials" });

    const token = jwt.sign(
      { id: admin._id, role: "admin" },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

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
