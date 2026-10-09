const router = require("express").Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");

/* +91 / 0 prefix aur spaces clean karke 10-digit phone banao */
function cleanPhone(v) {
  let p = String(v || "").replace(/\D/g, "");
  if (p.length === 12 && p.startsWith("91")) p = p.slice(2);
  if (p.length === 11 && p.startsWith("0")) p = p.slice(1);
  return p;
}

function signToken(user) {
  return jwt.sign(
    { id: user._id, phone: user.phone },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
}

/* ============ REGISTER ============ */
router.post("/register", async (req, res) => {
  try {
    const { password, password_confirmation, withdraw_password, ref_by } =
      req.body || {};
    const phone = cleanPhone(req.body && req.body.phone);

    if (!/^[6-9]\d{9}$/.test(phone))
      return res.status(400).json({
        success: false,
        message: "Enter a valid 10-digit Indian mobile number",
      });

    if (!password || String(password).length < 6)
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters",
      });

    if (String(password) !== String(password_confirmation || ""))
      return res
        .status(400)
        .json({ success: false, message: "Passwords do not match" });

    if (!withdraw_password || String(withdraw_password).length < 6)
      return res.status(400).json({
        success: false,
        message: "Withdraw password must be at least 6 characters",
      });

    if (String(withdraw_password) === String(password))
      return res.status(400).json({
        success: false,
        message: "Withdraw password cannot be same as login password",
      });

    const exists = await User.findOne({ phone });
    if (exists)
      return res.status(409).json({
        success: false,
        message: "This mobile number is already registered. Please login.",
      });

    const hash = await bcrypt.hash(String(password), 10);
    const whash = await bcrypt.hash(String(withdraw_password), 10);

    const user = await User.create({
      phone,
      password: hash,
      withdrawPassword: whash,
      refBy: String(ref_by || "").trim(),
    });

    const token = signToken(user);
    return res.json({
      success: true,
      message: "Register successful",
      token,
      user: { phone: user.phone, refBy: user.refBy },
    });
  } catch (e) {
    console.error("register error:", e.message);
    return res
      .status(500)
      .json({ success: false, message: "Server error, please try again" });
  }
});

/* ============ LOGIN ============ */
router.post("/login", async (req, res) => {
  try {
    const { password } = req.body || {};
    const phone = cleanPhone(req.body && req.body.phone);

    if (!/^[6-9]\d{9}$/.test(phone) || !password)
      return res.status(400).json({
        success: false,
        message: "Enter valid phone number and password",
      });

    const user = await User.findOne({ phone });
    if (!user)
      return res.status(401).json({
        success: false,
        message: "Account not found. Please register first.",
      });

    const ok = await bcrypt.compare(String(password), user.password);
    if (!ok)
      return res
        .status(401)
        .json({ success: false, message: "Incorrect password" });

    const token = signToken(user);
    return res.json({
      success: true,
      message: "Login successful",
      token,
      user: { phone: user.phone, refBy: user.refBy },
    });
  } catch (e) {
    console.error("login error:", e.message);
    return res
      .status(500)
      .json({ success: false, message: "Server error, please try again" });
  }
});

module.exports = router;
