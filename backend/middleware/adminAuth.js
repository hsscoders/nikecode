const jwt = require("jsonwebtoken");
const Admin = require("../models/Admin");

/* Admin JWT guard — Authorization: Bearer <token>
   Numeric-id coercion matches the user guard (legacy ObjectId tokens
   fail cleanly instead of casting inside SQL). */
module.exports = async function adminAuth(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token)
      return res.status(401).json({ success: false, message: "Unauthorized" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== "admin")
      return res.status(401).json({ success: false, message: "Unauthorized" });

    const aid = Number(decoded.id);
    if (!Number.isInteger(aid) || aid <= 0)
      return res.status(401).json({ success: false, message: "Unauthorized" });

    const admin = await Admin.findByPk(aid);
    if (!admin)
      return res.status(401).json({ success: false, message: "Unauthorized" });

    req.admin = admin;
    next();
  } catch {
    return res
      .status(401)
      .json({ success: false, message: "Session expired, login again" });
  }
};
