/* ============================================================
   WALLET / BUSINESS-LOGIC TESTS (Phase F regression)
   - invest: atomic deduction, plan limit, insufficient balance,
     L1 commission credited to the referrer
   - withdraw: password check, limits, charge math, refund on
     reject exactly-once, illegal transitions blocked
   - money edit guards (admin PUT /users)
   ============================================================ */
const { test, before, beforeEach, after } = require("node:test");
const assert = require("node:assert");
const bcrypt = require("bcryptjs");

const H = require("./helpers");
const User = require("../models/User");
const Plan = require("../models/Plan");
const Invest = require("../models/Invest");
const Withdrawal = require("../models/Withdrawal");
const Deposit = require("../models/Deposit");
const Transaction = require("../models/Transaction");
const Admin = require("../models/Admin");

let base, httpServer, adminToken;

before(async () => {
  await H.startDb();
  const app = H.buildApp();
  const l = await H.listen(app);
  base = l.base;
  httpServer = l.server;
});

beforeEach(async () => {
  await H.cleanDb();
  await H.seedSettings();
  const admin = await Admin.create({
    username: "bizadmin",
    password: await bcrypt.hash("strongpass1", 10),
    name: "Biz Admin",
  });
  const r = await H.call(base, "POST", "/api/admin/auth/login", {
    body: { username: "bizadmin", password: "strongpass1" },
  });
  adminToken = r.json.token;
});

after(async () => {
  try {
    if (httpServer) httpServer.close();
  } catch (e) {}
  await H.stopDb();
});

const login = async (phone) => {
  const r = await H.call(base, "POST", "/api/auth/login", {
    body: { phone, password: "loginpass" },
  });
  return r.json.token;
};

/* ============ INVEST ============ */
test("invest buys a plan atomically and pays L1 commission to the referrer", async () => {
  const referrer = await H.mkUser({ phone: "9700000001", refId: "ZPREFAAA01" });
  const buyer = await H.mkUser({ phone: "9700000002", rechargeBalance: 600, refBy: "ZPREFAAA01" });
  const plan = await Plan.create({
    name: "Starter",
    price: 530,
    daily: 63.6,
    cycle: 10,
    total: 636,
    limit: 1,
    active: true,
  });

  const token = await login("9700000002");
  const r = await H.call(base, "POST", "/api/invest", { token, body: { planId: String(plan.id) } });
  assert.equal(r.json.success, true, JSON.stringify(r.json));

  const b = await User.findByPk(buyer.id);
  assert.equal(Number(b.rechargeBalance), 70, "530 deducted atomically");

  const ref = await User.findByPk(referrer.id);
  assert.equal(Number(ref.balance), 132.5, "L1 commission 25% of 530");

  const inv = await Invest.findOne({ where: { user: buyer.id } });
  assert.equal(inv.status, "Active");
  const txn = await Transaction.findOne({ where: { user: buyer.id, type: "invest" } });
  assert.equal(Number(txn.amount), 530);
});

test("invest refuses when balance is short (no deduction)", async () => {
  const buyer = await H.mkUser({ phone: "9700000003", rechargeBalance: 100 });
  const plan = await Plan.create({ name: "Gold", price: 2500, daily: 266, cycle: 15, total: 4000, active: true });
  const token = await login("9700000003");
  const r = await H.call(base, "POST", "/api/invest", { token, body: { planId: String(plan.id) } });
  assert.equal(r.status, 400);
  assert.equal(Number((await User.findByPk(buyer.id)).rechargeBalance), 100, "balance untouched");
});

test("plan purchase limit is enforced per user", async () => {
  const buyer = await H.mkUser({ phone: "9700000004", rechargeBalance: 3000 });
  const plan = await Plan.create({ name: "L1", price: 530, daily: 63, cycle: 10, total: 636, limit: 1, active: true });
  const token = await login("9700000004");
  const r1 = await H.call(base, "POST", "/api/invest", { token, body: { planId: String(plan.id) } });
  assert.equal(r1.json.success, true);
  const b2 = await User.findByPk(buyer.id);
  b2.rechargeBalance = Number(b2.rechargeBalance) + 1000;
  await b2.save();
  const r2 = await H.call(base, "POST", "/api/invest", { token, body: { planId: String(plan.id) } });
  assert.equal(r2.status, 400);
  assert.match(r2.json.message, /limit/i);
});

test("presale plans cannot be bought", async () => {
  await H.mkUser({ phone: "9700000005", rechargeBalance: 20000 });
  const plan = await Plan.create({ name: "Diamond", price: 11000, daily: 1550, cycle: 15, total: 23250, presale: true, active: true });
  const token = await login("9700000005");
  const r = await H.call(base, "POST", "/api/invest", { token, body: { planId: String(plan.id) } });
  assert.equal(r.status, 400);
});

/* ============ WITHDRAW ============ */
async function mkWd({ amount = 200 } = {}) {
  const user = await H.mkUser({ phone: "9700000006", balance: 1000 });
  const token = await login("9700000006");
  const r = await H.call(base, "POST", "/api/withdraw", {
    token,
    body: {
      amount,
      withdraw_password: "wdpass",
      bank: { realName: "Test User", bankName: "HDFC", account: "123456789012", ifsc: "HDFC0000001" },
    },
  });
  return { user, token, r };
}

test("withdraw request deducts the hold and applies the charge", async () => {
  const { user, r } = await mkWd({ amount: 200 });
  assert.equal(r.json.success, true, JSON.stringify(r.json));
  assert.equal(Number((await User.findByPk(user.id)).balance), 800, "200 held");
  assert.equal(r.json.withdrawal.charge, 20, "10% charge");
  assert.equal(r.json.withdrawal.netAmount, 180);
});

test("withdraw rejects wrong password / short amount / bad IFSC", async () => {
  const user = await H.mkUser({ phone: "9700000007", balance: 1000 });
  const token = await login("9700000007");
  const bank = { realName: "Test", bankName: "HDFC", account: "123456789012", ifsc: "HDFC0000001" };

  const badPw = await H.call(base, "POST", "/api/withdraw", {
    token, body: { amount: 200, withdraw_password: "WRONG", bank },
  });
  assert.equal(badPw.status, 400);

  const small = await H.call(base, "POST", "/api/withdraw", {
    token, body: { amount: 10, withdraw_password: "wdpass", bank },
  });
  assert.equal(small.status, 400, "below min 130");

  const badIfsc = await H.call(base, "POST", "/api/withdraw", {
    token,
    body: { amount: 200, withdraw_password: "wdpass", bank: { ...bank, ifsc: "XXX" } },
  });
  assert.equal(badIfsc.status, 400);

  assert.equal(Number((await User.findByPk(user.id)).balance), 1000, "no deduction on failures");
});

test("admin reject refunds exactly once; Success is terminal", async () => {
  const { user, r } = await mkWd({ amount: 200 });
  const wdId = r.json.withdrawal.id;
  assert.equal(Number((await User.findByPk(user.id)).balance), 800);

  const rej = await H.call(base, "PUT", "/api/admin/withdrawals/" + wdId, {
    token: adminToken,
    body: { status: "Rejected" },
  });
  assert.equal(rej.json.success, true);
  assert.equal(Number((await User.findByPk(user.id)).balance), 1000, "refunded");

  // duplicate reject (already Rejected → "No change") must NOT refund again
  const rej2 = await H.call(base, "PUT", "/api/admin/withdrawals/" + wdId, {
    token: adminToken,
    body: { status: "Rejected" },
  });
  assert.equal(rej2.json.success, true);
  assert.equal(Number((await User.findByPk(user.id)).balance), 1000, "no double refund");

  // re-open then approve → Success is terminal → third change must fail
  await H.call(base, "PUT", "/api/admin/withdrawals/" + wdId, { token: adminToken, body: { status: "Pending" } });
  assert.equal(Number((await User.findByPk(user.id)).balance), 800, "refund revoked on re-open");
  const ok = await H.call(base, "PUT", "/api/admin/withdrawals/" + wdId, { token: adminToken, body: { status: "Success" } });
  assert.equal(ok.json.success, true);
  const illegal = await H.call(base, "PUT", "/api/admin/withdrawals/" + wdId, { token: adminToken, body: { status: "Rejected" } });
  assert.equal(illegal.status, 400, "Success → Rejected is illegal (would double-pay)");
  assert.equal(Number((await User.findByPk(user.id)).balance), 800);
});

/* ============ DEPOSIT status (admin approve/revoke) ============ */
test("admin approving a deposit credits exactly once and revoking debits once", async () => {
  const user = await H.mkUser({ phone: "9700000008" });
  const dep = await Deposit.create({
    user: user.id, userid: user.userid, phone: user.phone,
    amount: 500, method: "Pay-T", status: "Pending", note: "manual",
  });
  await Transaction.create({ user: user.id, phone: user.phone, type: "recharge", amount: 500, status: "Pending", refId: String(dep.id) });

  const ok = await H.call(base, "PUT", "/api/admin/deposits/" + dep.id, { token: adminToken, body: { status: "Success" } });
  assert.equal(ok.json.success, true);
  assert.equal(Number((await User.findByPk(user.id)).rechargeBalance), 500);

  // duplicate approve → "No change", must not double credit
  await H.call(base, "PUT", "/api/admin/deposits/" + dep.id, { token: adminToken, body: { status: "Success" } });
  assert.equal(Number((await User.findByPk(user.id)).rechargeBalance), 500);

  const rev = await H.call(base, "PUT", "/api/admin/deposits/" + dep.id, { token: adminToken, body: { status: "Rejected" } });
  assert.equal(rev.json.success, true);
  assert.equal(Number((await User.findByPk(user.id)).rechargeBalance), 0);
});

/* ============ IDOR checks ============ */
test("user cannot read another user's wallet/transactions (IDOR)", async () => {
  await H.mkUser({ phone: "9700000009", balance: 777 });
  const other = await H.mkUser({ phone: "9700000010", balance: 1 });
  const token = await login("9700000010");

  const w = await H.call(base, "GET", "/api/wallet", { token });
  assert.equal(Number(w.json.wallet.balance), 1, "wallet is scoped to the token's user");

  const t = await H.call(base, "GET", "/api/transactions", { token });
  assert.equal(t.json.txns.length, 0, "no one else's ledger rows");
});

/* ============ legacy settings row ============ */
test("PUT /settings works even when the settings row is missing entirely", async () => {
  // a fresh/legacy install may have no settings row — getGlobal() must
  // fall back to schema defaults and saveGlobal() must upsert cleanly
  const Setting = require("../models/Setting");
  await Setting.destroy({ where: { key: "global" } });

  const r1 = await H.call(base, "PUT", "/api/admin/settings", {
    token: adminToken,
    body: { withdraw: { minAmount: 150, chargePercent: 5 } },
  });
  assert.equal(r1.status, 200, "no 500 on missing settings row: " + JSON.stringify(r1.json));

  const r2 = await H.call(base, "PUT", "/api/admin/commission", {
    token: adminToken,
    body: { level1: 20, level2: 3, level3: 2 },
  });
  assert.equal(r2.status, 200, "commission PUT works from defaults");

  const s = await Setting.getGlobal();
  assert.equal(s.withdraw.minAmount, 150);
  assert.equal(s.withdraw.chargePercent, 5);
  assert.equal(s.commission.level1, 20);
  assert.equal(s.qwackpay.baseUrl, "https://qwackpay.com/api/v1", "untouched section keeps defaults");
});
