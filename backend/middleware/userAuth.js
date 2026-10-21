const jwt = require("jsonwebtoken");
const User = require("../models/User");

/* User JWT guard — Authorization: Bearer <token>
   Token ids are numeric MySQL PKs now; legacy MongoDB-era tokens carry
   ObjectIds, which Number() rejects (NaN → clean 401) instead of letting
   a hex string implicitly cast in SQL. */
module.exports = async function userAuth(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token)
      return res
        .status(401)
        .json({ success: false, message: "Please login first" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const uid = Number(decoded.id);
    if (!Number.isInteger(uid) || uid <= 0)
      return res
        .status(401)
        .json({ success: false, message: "Session expired, login again" });

    const user = await User.findByPk(uid);
    if (!user)
      return res
        .status(401)
        .json({ success: false, message: "Account not found" });
    if (user.status === "Banned")
      return res
        .status(403)
        .json({ success: false, message: "Your account has been banned" });

    req.user = user;
    next();
  } catch {
    return res
      .status(401)
      .json({ success: false, message: "Session expired, login again" });
  }
};
