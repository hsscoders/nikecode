/* ============================================================
   PAYMENT INTEGRITY & IDEMPOTENCY TESTS (Phase D regression)
   - duplicate webhooks credit exactly once
   - invalid signatures never move money
   - valid signature + MISMATCHED amount never credits (FIX 1)
   - reconciliation works without gatewayOrderId (FIX 1b)
   - concurrent webhooks → single credit
   - payout settle/refund exactly-once
   Gateway = local mock http server (no real network).
   ============================================================ */
const { test, before, beforeEach, after } = require("node:test");
const assert = require("node:assert");
const http = require("http");

const H = require("./helpers");
const Deposit = require("../models/Deposit");
const Withdrawal = require("../models/Withdrawal");
const User = require("../models/User");
const Transaction = require("../models/Transaction");

let base, httpServer;
let mockGw = null; // local "gateway" the backend will query for reconciliation

before(async () => {
  await H.startDb();
  app = H.buildApp();
  const l = await H.listen(app);
  base = l.base;
  httpServer = l.server;
});

beforeEach(async () => {
  await H.cleanDb();
  await H.seedSettings();
});

after(async () => {
  try {
    if (httpServer) httpServer.close();
  } catch (e) {}
  await H.stopDb();
});

/* spin a fake qwackpay /order/query endpoint */
async function startGatewayMock(response) {
  const server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(response));
    });
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  return { server, url: "http://127.0.0.1:" + server.address().port + "/api/v1" };
}

async function mkDeposit({ amount = 500, status = "Pending", gateway = "qwackpay", gatewayOrderId = "" } = {}) {
  const user = await H.mkUser({ phone: "9600000001", balance: 0, rechargeBalance: 0 });
  const d = await Deposit.create({
    user: user._id,
    userid: user.userid,
    phone: user.phone,
    amount,
    method: "QwackPay",
    status,
    gateway,
    gatewayOrderId,
    note: "test order",
  });
  await Transaction.create({
    user: user._id,
    userid: user.userid,
    phone: user.phone,
    type: "recharge",
    title: "Recharge",
    method: "QwackPay",
    amount,
    status: "Pending",
    refId: String(d._id),
  });
  return { user, deposit: d };
}

function qwackNotifyBody(depositId, { amount = 500, status = "success", utr = "UTR123" } = {}) {
  const p = {
    merchant_order_id: String(depositId),
    qwack_order_id: "GW-ORDER-1",
    amount: String(amount),
    status,
    utr,
  };
  return { ...p, sign: H.qwackSign(p, H.QWACK_KEY) };
}

const balanceOf = async (id) => (await User.findById(id)).rechargeBalance;

/* ============ 1. duplicate success webhook → credited ONCE ============ */
test("qwackpay webhook delivered twice credits the wallet exactly once", async () => {
  const { user, deposit } = await mkDeposit({});
  const body = qwackNotifyBody(deposit._id);

  const r1 = await H.call(base, "POST", "/api/payments/qwackpay/notify", { body });
  const r2 = await H.call(base, "POST", "/api/payments/qwackpay/notify", { body });

  assert.equal(r1.status, 200);
  assert.equal(r1.text, "success");
  assert.equal(r2.text, "success"); // ack the replay

  assert.equal(await balanceOf(user._id), 500, "credited exactly once");
  const d = await Deposit.findById(deposit._id);
  assert.equal(d.status, "Success");
  const txns = await Transaction.find({ refId: String(deposit._id), status: "Success" });
  assert.equal(txns.length, 1, "ledger flips once");
});

/* ============ 2. invalid signature → 401, no state change ============ */
test("qwackpay webhook with forged sign is rejected without touching money", async () => {
  const { user, deposit } = await mkDeposit({});
  const body = qwackNotifyBody(deposit._id);
  body.sign = body.sign.slice(0, -2) + "FF"; // tamper

  const r = await H.call(base, "POST", "/api/payments/qwackpay/notify", { body });
  assert.equal(r.status, 401);
  assert.equal(await balanceOf(user._id), 0);
  assert.equal((await Deposit.findById(deposit._id)).status, "Pending");
});

/* ============ 3. FIX 1 regression: valid sign + wrong amount → NOT credited ============ */
test("qwackpay webhook with valid sign but mismatched amount stays Pending", async () => {
  const { user, deposit } = await mkDeposit({ amount: 500 });
  const body = qwackNotifyBody(deposit._id, { amount: 400 }); // signed, but wrong

  const r = await H.call(base, "POST", "/api/payments/qwackpay/notify", { body });
  assert.equal(r.status, 200); // acked so the gateway stops retrying
  assert.equal(r.text, "success");
  assert.equal(await balanceOf(user._id), 0, "no credit on amount mismatch");
  assert.equal((await Deposit.findById(deposit._id)).status, "Pending", "left for reconciliation");
});

/* ============ 4. matching amount credits normally ============ */
test("qwackpay webhook with matching amount credits", async () => {
  const { user, deposit } = await mkDeposit({ amount: 500 });
  const r = await H.call(base, "POST", "/api/payments/qwackpay/notify", {
    body: qwackNotifyBody(deposit._id, { amount: 500 }),
  });
  assert.equal(r.status, 200);
  assert.equal(await balanceOf(user._id), 500);
  assert.equal((await Deposit.findById(deposit._id)).status, "Success");
});

/* ============ 5. concurrent duplicate webhooks → single credit ============ */
test("two CONCURRENT valid qwackpay webhooks credit exactly once", async () => {
  const { user, deposit } = await mkDeposit({});
  const body = qwackNotifyBody(deposit._id);

  const [r1, r2, r3] = await Promise.all([
    H.call(base, "POST", "/api/payments/qwackpay/notify", { body }),
    H.call(base, "POST", "/api/payments/qwackpay/notify", { body }),
    H.call(base, "POST", "/api/payments/qwackpay/notify", { body }),
  ]);

  assert.ok(r1.status === 200 && r2.status === 200 && r3.status === 200);
  assert.equal(await balanceOf(user._id), 500, "atomic claim allows only one credit");
});

/* ============ 6. replay after terminal state → no side effect ============ */
test("late success webhook after Rejected does not resurrect or credit", async () => {
  const { user, deposit } = await mkDeposit({});
  await Deposit.updateOne(
    { _id: deposit._id },
    { $set: { status: "Rejected", note: "gateway reported: failed" } }
  );
  await Transaction.updateOne({ refId: String(deposit._id) }, { $set: { status: "Rejected" } });

  const r = await H.call(base, "POST", "/api/payments/qwackpay/notify", {
    body: qwackNotifyBody(deposit._id, { status: "success" }),
  });
  assert.equal(r.text, "success");
  assert.equal(await balanceOf(user._id), 0);
  assert.equal((await Deposit.findById(deposit._id)).status, "Rejected");
});

/* ============ 7. OKPay pay_money rule + sign case ============ */
test("okpay webhook credits pay_money (actual paid) and rejects forged sign", async () => {
  const user = await H.mkUser({ phone: "9600000002" });
  const d = await Deposit.create({
    user: user._id,
    userid: user.userid,
    phone: user.phone,
    amount: 500,
    method: "OKPay",
    status: "Pending",
    gateway: "okpay",
    note: "t",
  });
  await Transaction.create({
    user: user._id,
    phone: user.phone,
    type: "recharge",
    amount: 500,
    status: "Pending",
    refId: String(d._id),
  });

  // forged first
  const bad = await H.call(base, "POST", "/api/payments/okpay/notify", {
    form: { mchId: "M456", out_trade_no: String(d._id), money: "500", pay_money: "480", status: "1", sign: "deadbeef" },
  });
  assert.equal(bad.status, 401);

  const p = {
    mchId: "M456",
    out_trade_no: String(d._id),
    currency: "INR",
    money: "500",
    pay_money: "480",
    status: "1",
  };
  const ok = await H.call(base, "POST", "/api/payments/okpay/notify", {
    form: { ...p, sign: H.okpaySign(p, H.OKPAY_KEY) },
  });
  assert.equal(ok.status, 200);
  assert.equal(ok.text, "success");
  assert.equal(await balanceOf(user._id), 480, "credited by pay_money per OKPay docs");
  assert.equal((await Deposit.findById(d._id)).status, "Success");
});

/* ============ 8. payout webhook: settle once, refund once ============ */
test("qwackpay payout webhook settles success exactly once", async () => {
  const user = await H.mkUser({ phone: "9600000003", balance: 1000 });
  // withdraw request (already deducted the hold) — simulate post-deduction state
  const wd = await Withdrawal.create({
    user: user._id,
    userid: user.userid,
    phone: user.phone,
    amount: 200,
    chargePercent: 10,
    charge: 20,
    netAmount: 180,
    realName: "Test User",
    bankName: "HDFC",
    account: "123456789012",
    ifsc: "HDFC0000001",
    status: "Pending",
    autoPayout: true,
    gateway: "qwackpay",
    payoutOrderId: "PENDING",
  });
  await Withdrawal.updateOne({ _id: wd._id }, { payoutOrderId: "WD" + wd._id });
  /* mirror the real flow — the request already deducted the hold */
  await User.updateOne({ _id: user._id }, { $inc: { balance: -200 } });

  const p = {
    merchant_order_id: "WD" + wd._id,
    qwack_order_id: "GWP-1",
    amount: "180",
    status: "success",
    utr: "UTR-9",
  };
  const body = { ...p, sign: H.qwackSign(p, H.QWACK_KEY) };

  const r1 = await H.call(base, "POST", "/api/payments/qwackpay/payout-notify", { body });
  const r2 = await H.call(base, "POST", "/api/payments/qwackpay/payout-notify", { body });
  assert.equal(r1.text, "success");
  assert.equal(r2.text, "success");

  const w = await Withdrawal.findById(wd._id);
  assert.equal(w.status, "Success");
  assert.equal(w.utr, "UTR-9");
  assert.equal((await User.findById(user._id)).balance, 800, "hold stays deducted (paid out)");
});

test("payout FAILED webhook refunds the hold exactly once (double delivery)", async () => {
  const user = await H.mkUser({ phone: "9600000004", balance: 1000 });
  const wd = await Withdrawal.create({
    user: user._id,
    userid: user.userid,
    phone: user.phone,
    amount: 200,
    netAmount: 180,
    realName: "Test User",
    bankName: "HDFC",
    account: "123456789012",
    ifsc: "HDFC0000001",
    status: "Pending",
    autoPayout: true,
    gateway: "qwackpay",
    payoutOrderId: "PENDING",
  });
  await Withdrawal.updateOne({ _id: wd._id }, { payoutOrderId: "WD" + wd._id });
  /* mirror the real flow — the request already deducted the hold */
  await User.updateOne({ _id: user._id }, { $inc: { balance: -200 } });

  const p = { merchant_order_id: "WD" + wd._id, qwack_order_id: "GWP-2", amount: "180", status: "failed" };
  const body = { ...p, sign: H.qwackSign(p, H.QWACK_KEY) };

  await Promise.all([
    H.call(base, "POST", "/api/payments/qwackpay/payout-notify", { body }),
    H.call(base, "POST", "/api/payments/qwackpay/payout-notify", { body }),
    H.call(base, "POST", "/api/payments/qwackpay/payout-notify", { body }),
  ]);

  assert.equal((await User.findById(user._id)).balance, 1000, "refunded exactly once");
  assert.equal((await Withdrawal.findById(wd._id)).status, "Rejected");
});

/* ============ 9. FIX 1b regression: reconciliation without gatewayOrderId ============ */
test("status poll reconciles a Pending order even when gatewayOrderId is empty", async () => {
  const mock = await startGatewayMock({
    code: 200,
    message: "ok",
    data: { status: "success", amount: 500, qwack_order_id: "GW-LATE-1" },
  });
  mockGw = mock;
  try {
    // rewrite the saved gateway baseUrl to the local mock
    const Setting = require("../models/Setting");
    await Setting.updateOne({ key: "global" }, { $set: { "qwackpay.baseUrl": mock.url } });

    const { user, deposit } = await mkDeposit({ gatewayOrderId: "" }); // ← the old guard skipped these

    const token = (await userAuthToken(base, user.phone)).token;
    const r = await H.call(base, "GET", "/api/payments/qwackpay/status/" + deposit._id, { token });

    assert.equal(r.status, 200);
    assert.equal(r.json.order.status, "Success", "reconciled via merchant order id");
    assert.equal(await balanceOf(user._id), 500);
  } finally {
    mock.server.close();
  }
});

test("status poll does NOT credit when the gateway reports a mismatched amount", async () => {
  const mock = await startGatewayMock({
    code: 200,
    message: "ok",
    data: { status: "success", amount: 999, qwack_order_id: "GW-LATE-2" },
  });
  try {
    const Setting = require("../models/Setting");
    await Setting.updateOne({ key: "global" }, { $set: { "qwackpay.baseUrl": mock.url } });

    const { user, deposit } = await mkDeposit({ amount: 500, gatewayOrderId: "" });
    const token = (await userAuthToken(base, user.phone)).token;
    const r = await H.call(base, "GET", "/api/payments/qwackpay/status/" + deposit._id, { token });

    assert.equal(r.json.order.status, "Pending", "mismatch stays Pending");
    assert.equal(await balanceOf(user._id), 0);
  } finally {
    mock.server.close();
  }
});

/* helper — login through the API to get a real user token */
async function userAuthToken(base, phone) {
  const r = await H.call(base, "POST", "/api/auth/login", {
    body: { phone, password: "loginpass" },
  });
  assert.equal(r.json.success, true, "fixture login failed: " + JSON.stringify(r.json));
  return r.json;
}
