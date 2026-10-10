const jwt = require("jsonwebtoken");
const User = require("../models/User");

/* User JWT guard — Authorization: Bearer <token> */
module.exports = async function userAuth(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token)
      return res
        .status(401)
        .json({ success: false, message: "Please login first" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
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
