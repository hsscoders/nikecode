/* ============================================================
   AUTH TESTS (Phase C/F regression)
   - register validation + duplicate handling
   - login success / wrong password / banned
   - one-click login: single-use + CONCURRENT redemption race
     (FIX 2 regression — atomic claim)
   JWT_SECRET comes from the harness env.
   ============================================================ */
const { test, before, beforeEach, after } = require("node:test");
const assert = require("node:assert");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");

const H = require("./helpers");
const LoginCode = require("../models/LoginCode");
const User = require("../models/User");

let base, httpServer;

before(async () => {
  await H.startDb();
  const app = H.buildApp();
  const l = await H.listen(app);
  base = l.base;
  httpServer = l.server;
});

beforeEach(async () => {
  await H.cleanDb();
});

after(async () => {
  try {
    if (httpServer) httpServer.close();
  } catch (e) {}
  await H.stopDb();
});

/* ============ register ============ */
test("register happy path returns token + unique ids", async () => {
  const r = await H.apiRegister(base, "9812345678");
  assert.equal(r.status, 200);
  assert.equal(r.json.success, true);
  assert.ok(r.json.token);
  assert.match(r.json.user.userid, /^ZP\d{6}$/);
  assert.match(r.json.user.refId, /^ZP[A-Z0-9]{8}$/);
});

test("register rejects invalid phone / password mismatch / short password", async () => {
  const badPhone = await H.apiRegister(base, "12345");
  assert.equal(badPhone.status, 400);

  const mismatch = await H.call(base, "POST", "/api/auth/register", {
    body: { phone: "9812345679", password: "loginpass", password_confirmation: "other", withdraw_password: "wdpass1" },
  });
  assert.equal(mismatch.status, 400);

  const shortPw = await H.call(base, "POST", "/api/auth/register", {
    body: { phone: "9812345679", password: "123", password_confirmation: "123", withdraw_password: "wdpass1" },
  });
  assert.equal(shortPw.status, 400);

  const samePw = await H.call(base, "POST", "/api/auth/register", {
    body: { phone: "9812345679", password: "abc123", password_confirmation: "abc123", withdraw_password: "abc123" },
  });
  assert.equal(samePw.status, 400, "withdraw password must differ from login password");
});

test("register rejects invalid invite code; valid code links refBy", async () => {
  const badRef = await H.apiRegister(base, "9812345670", { ref_by: "ZPNOPE0000" });
  assert.equal(badRef.status, 400);

  // referrer must exist first
  const referrer = await H.apiRegister(base, "9812345671");
  const refId = referrer.json.user.refId;
  const child = await H.apiRegister(base, "9812345672", { ref_by: refId });
  assert.equal(child.status, 200);
  const u = await User.findOne({ where: { phone: "9812345672" } });
  assert.equal(u.refBy, refId);
});

test("duplicate phone register returns 409", async () => {
  await H.apiRegister(base, "9812345673");
  const again = await H.apiRegister(base, "9812345673");
  assert.equal(again.status, 409);
});

/* ============ login ============ */
test("login success + wrong password + unknown phone", async () => {
  await H.apiRegister(base, "9812345674");

  const ok = await H.call(base, "POST", "/api/auth/login", {
    body: { phone: "9812345674", password: "loginpass" },
  });
  assert.equal(ok.json.success, true);
  assert.ok(ok.json.token);

  const wrong = await H.call(base, "POST", "/api/auth/login", {
    body: { phone: "9812345674", password: "nope-nope" },
  });
  assert.equal(wrong.status, 401);

  const unknown = await H.call(base, "POST", "/api/auth/login", {
    body: { phone: "9800000001", password: "whatever" },
  });
  assert.equal(unknown.status, 401);
});

test("banned user cannot login", async () => {
  await H.apiRegister(base, "9812345675");
  await User.update({ status: "Banned" }, { where: { phone: "9812345675" } });
  const r = await H.call(base, "POST", "/api/auth/login", {
    body: { phone: "9812345675", password: "loginpass" },
  });
  assert.equal(r.status, 403);
});

/* ============ one-click login — single use ============ */
test("auto-login code is single-use; second redemption fails", async () => {
  const u = await H.mkUser({ phone: "9812345676" });
  const code = crypto.randomBytes(24).toString("hex");
  await LoginCode.create({ code, user: u.id, expiresAt: new Date(Date.now() + 3600e3) });

  const first = await H.call(base, "POST", "/api/auth/auto-login", { body: { code } });
  assert.equal(first.json.success, true);
  assert.ok(first.json.token);

  const second = await H.call(base, "POST", "/api/auth/auto-login", { body: { code } });
  assert.equal(second.status, 400);
});

test("FIX 2 regression: two CONCURRENT redemptions of one code — exactly one wins", async () => {
  const u = await H.mkUser({ phone: "9812345677" });
  const code = crypto.randomBytes(24).toString("hex");
  await LoginCode.create({ code, user: u.id, expiresAt: new Date(Date.now() + 3600e3) });

  const [a, b] = await Promise.all([
    H.call(base, "POST", "/api/auth/auto-login", { body: { code } }),
    H.call(base, "POST", "/api/auth/auto-login", { body: { code } }),
  ]);

  const wins = [a, b].filter((r) => r.status === 200 && r.json.success).length;
  assert.equal(wins, 1, "atomic claim must let exactly one redemption through");
});

test("expired auto-login code is refused", async () => {
  const u = await H.mkUser({ phone: "9812345678" });
  const code = crypto.randomBytes(24).toString("hex");
  await LoginCode.create({ code, user: u.id, expiresAt: new Date(Date.now() - 1000) });
  const r = await H.call(base, "POST", "/api/auth/auto-login", { body: { code } });
  assert.equal(r.status, 400);
});

/* ============ JWT guard ============ */
test("protected route rejects missing / garbage / user-token-as-admin", async () => {
  const none = await H.call(base, "GET", "/api/wallet");
  assert.equal(none.status, 401);

  const garbage = await H.call(base, "GET", "/api/wallet", { token: "not.a.jwt" });
  assert.equal(garbage.status, 401);

  // a USER token must not open ADMIN routes (privilege escalation check)
  const reg = await H.apiRegister(base, "9812345679");
  const asAdmin = await H.call(base, "GET", "/api/admin/users", { token: reg.json.token });
  assert.equal(asAdmin.status, 401);
});

/* ============ admin auth ============ */
test("admin login works with seeded creds and rejects wrong password", async () => {
  await Admin.create({
    username: "auditadmin",
    password: await bcrypt.hash("strongpass1", 10),
    name: "Audit Admin",
  });
  const ok = await H.call(base, "POST", "/api/admin/auth/login", {
    body: { username: "auditadmin", password: "strongpass1" },
  });
  assert.equal(ok.json.success, true);
  assert.ok(ok.json.token);

  const bad = await H.call(base, "POST", "/api/admin/auth/login", {
    body: { username: "auditadmin", password: "wrong" },
  });
  assert.equal(bad.status, 401);
});

const Admin = require("../models/Admin");
