/* ============================================================
   Lightweight in-memory rate limiter (no external deps).

   Two limiters:
   - authRateLimit  → login / register / auto-login. Per-IP burst
     guard + per-phone lockout so password brute-force is useless.
   - moneyRateLimit → deposit / invest / withdraw / bank / gateway
     create. Per-user burst guard so no bot can spam money writes.

   Buckets are plain Maps with a periodic sweep — bounded memory,
   resets cleanly on process restart. NEVER count webhooks here:
   gateway notify endpoints stay open (signature-verified instead).
   ============================================================ */

const buckets = new Map(); /* key → { count, resetAt, fails, lockUntil } */
let lastSweep = Date.now();

/* drop expired buckets once a minute so the map never grows unbounded */
function sweep(now) {
  if (now - lastSweep < 60000) return;
  lastSweep = now;
  for (const [k, b] of buckets) {
    if (b.resetAt < now && (b.lockUntil || 0) < now) buckets.delete(k);
  }
}

/* one sliding-window counter — returns { ok, retryAfter } */
function hit(key, limit, windowMs) {
  const now = Date.now();
  sweep(now);
  const b = buckets.get(key);
  if (!b || b.resetAt < now) {
    buckets.set(key, {
      count: 1,
      resetAt: now + windowMs,
      fails: (b && b.fails) || 0,
      lockUntil: (b && b.lockUntil) || 0,
    });
    return { ok: true };
  }
  b.count++;
  if (b.count > limit)
    return { ok: false, retryAfter: Math.ceil((b.resetAt - now) / 1000) };
  return { ok: true };
}

const tooMany = (res, retryAfter) =>
  res.status(429).json({
    success: false,
    message:
      "Too many requests — please slow down and try again in " +
      Math.max(1, retryAfter || 1) +
      "s",
  });

const ipOf = (req) =>
  (req.headers["x-forwarded-for"] || "").split(",")[0].trim() ||
  req.socket?.remoteAddress ||
  "unknown";

/* ============ AUTH: brute-force protection ============
   Window: 10 min. 20 auth calls per IP, max 8 attempts per phone
   number. After 8 wrong-password rounds on one phone the bucket
   locks for another 10 min — bcrypt stays the only fast path. */
const AUTH_WINDOW = 10 * 60 * 1000;

module.exports.authRateLimit = function authRateLimit(req, res, next) {
  const phone = String((req.body && req.body.phone) || (req.body && req.body.code) || "")
    .replace(/\D/g, "")
    .slice(0, 12);

  const ip = hit("ip:" + ipOf(req), 20, AUTH_WINDOW);
  if (!ip.ok) return tooMany(res, ip.retryAfter);

  if (phone) {
    const key = "phone:" + phone;
    const b = buckets.get(key);
    if (b && b.lockUntil && b.lockUntil > Date.now())
      return tooMany(res, Math.ceil((b.lockUntil - Date.now()) / 1000));
    const ph = hit(key, 8, AUTH_WINDOW);
    if (!ph.ok) {
      /* lock the phone for the remainder of the window */
      const cur = buckets.get(key);
      if (cur) cur.lockUntil = cur.resetAt;
      return tooMany(res, ph.retryAfter);
    }
  }
  next();
};

/* ============ MONEY: per-user burst guard ============
   8 money-writes per 10s per user (IP fallback before auth runs).
   A human cannot out-spend this; a script gets a clean 429. */
const MONEY_WINDOW = 10 * 1000;

module.exports.moneyRateLimit = function moneyRateLimit(req, res, next) {
  const who =
    (req.user && req.user._id && "u:" + req.user._id) || "ip:" + ipOf(req);
  const r = hit("money:" + who, 8, MONEY_WINDOW);
  if (!r.ok) return tooMany(res, r.retryAfter);
  next();
};
