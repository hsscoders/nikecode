/* ============================================================
   AUDIT SERVICE — one call records an activity-trail entry.

   log(req, { actorType, actor, action, category, target, message, detail })

   Fire-and-forget by design: AuditLog.create() runs on its own and a
   failure only surfaces in the server log — the API response and the
   business flow are NEVER blocked by logging.

   The request object is optional; when present the client IP is taken
   from the proxy chain (X-Forwarded-For) exactly like the rate limiter.
   ============================================================ */

const AuditLog = require("../models/AuditLog");

const ipOf = (req) => {
  if (!req) return "";
  try {
    return (
      String(req.headers["x-forwarded-for"] || "")
        .split(",")[0]
        .trim() ||
      req.socket?.remoteAddress ||
      ""
    );
  } catch (e) {
    return "";
  }
};

function log(req, entry) {
  try {
    const e = entry || {};
    const actor = e.actor || {};
    AuditLog.create({
      actorType: e.actorType || "system",
      actorId: actor.id ? String(actor.id) : "",
      actorLabel: actor.label || "",
      action: e.action || "unknown",
      category: e.category || "system",
      target: String(e.target || "").slice(0, 120),
      message: String(e.message || "").slice(0, 400),
      detail: e.detail || {},
      ip: e.ip || ipOf(req),
    }).catch((err) => console.error("audit log error:", err.message));
  } catch (e) {
    console.error("audit log error:", e.message);
  }
}

module.exports = { log };
