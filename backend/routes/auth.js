const router = require("express").Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");

/* Normalize the phone: strip +91 / 0 prefix and spaces, keep 10 digits */
function cleanPhone(v) {
  let p = String(v || "").replace(/\D/g, "");
  if (p.length === 12 && p.startsWith("91")) p = p.slice(2);
  if (p.length === 11 && p.startsWith("0")) p = p.slice(1);
  return p;
}

function signToken(user) {
  return jwt.sign(
    { id: user._id, phone: user.phone, role: "user" },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
}

/* Generate a unique userid (ZP+6 digits) + refId (ZP+8 alnum) */
async function uniqueIds() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  for (let i = 0; i < 15; i++) {
    const userid = "ZP" + Math.floor(100000 + Math.random() * 900000);
    let ref = "ZP";
    for (let j = 0; j < 8; j++) ref += chars[Math.floor(Math.random() * chars.length)];
    const clash = await User.findOne({ $or: [{ userid }, { refId: ref }] });
    if (!clash) return { userid, refId: ref };
  }
  throw new Error("id generation failed");
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

    /* Invite code validation — only accept a valid refId (ZP+8), otherwise a clear error */
    const refCode = String(ref_by || "").trim().toUpperCase();
    if (refCode) {
      const refUser = await User.findOne({ refId: refCode });
      if (!refUser)
        return res
          .status(400)
          .json({ success: false, message: "Invalid invite code" });
    }

    const hash = await bcrypt.hash(String(password), 10);
    const whash = await bcrypt.hash(String(withdraw_password), 10);
    const { userid, refId } = await uniqueIds();

    const user = await User.create({
      phone,
      password: hash,
      withdrawPassword: whash,
      refBy: refCode,
      userid,
      refId,
    });

    const token = signToken(user);
    return res.json({
      success: true,
      message: "Register successful",
      token,
      user: { phone: user.phone, refBy: user.refBy, userid: user.userid, refId: user.refId },
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

    if (user.status === "Banned")
      return res.status(403).json({
        success: false,
        message: "Your account has been banned. Contact support.",
      });

    /* Backfill userid/refId for old users (migration on the fly) */
    if (!user.userid || !user.refId) {
      try {
        const ids = await uniqueIds();
        user.userid = ids.userid;
        user.refId = ids.refId;
        await user.save();
      } catch (e) {
        console.error("id backfill error:", e.message);
      }
    }

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
      user: {
        phone: user.phone,
        refBy: user.refBy,
        userid: user.userid,
        refId: user.refId,
        status: user.status,
      },
    });
  } catch (e) {
    console.error("login error:", e.message);
    return res
      .status(500)
      .json({ success: false, message: "Server error, please try again" });
  }
});

module.exports = router;
