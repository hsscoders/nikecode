const jwt = require("jsonwebtoken");
const Admin = require("../models/Admin");

/* Admin JWT guard — Authorization: Bearer <token> */
module.exports = async function adminAuth(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token)
      return res.status(401).json({ success: false, message: "Unauthorized" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== "admin")
      return res.status(401).json({ success: false, message: "Unauthorized" });

    const admin = await Admin.findById(decoded.id);
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
