const router = require("express").Router();
const userAuth = require("../middleware/userAuth");
const { moneyRateLimit } = require("../middleware/rateLimit");
const audit = require("../services/audit");
const { inc } = require("../db");
const Deposit = require("../models/Deposit");
const Withdrawal = require("../models/Withdrawal");
const Transaction = require("../models/Transaction");
const User = require("../models/User");
const { emitToUser, emitAdmin } = require("../live");
const qwack = require("../services/qwackpay");
const okpay = require("../services/okpay");
const { detectUrls } = require("../services/urls");

/* ============ AUTO RECHARGE + AUTO PAYOUT (multi-gateway) ============
   Flow (identical for every registered gateway):
   1. Client → POST /api/payments/<gw>/create { amount }
   2. Backend validates, stores a Pending Deposit, signs & calls the
      gateway's collect endpoint, saves the payment_url
   3. Client redirects the user to payment_url (hosted checkout)
   4. Gateway POSTs the result to /api/payments/<gw>/notify
      → signature verified → deposit credited idempotently
   5. Browser comes back to /recharge?paid=<orderId> (status banner)

   ⚠ OKPAY RULE (docs repeat it 3×): when crediting a payin, the amount
   basis is `pay_money` — what the user ACTUALLY paid — never `money`.
   Enforced in every okpay credit path below (webhook + status poll).

   MySQL migration note: the idempotency pattern is unchanged — a guarded
   UPDATE ... WHERE status='Pending' claim (affectedRows decides the race
   winner) does exactly what the Mongoose updateOne claim did.           */

const GATEWAY_MIN = 100; // per-order gateway limits (₹)
const GATEWAY_MAX = 100000;

/* Ledger ref key — the string historical rows were written with
   (pre-migration ObjectId or the new numeric id) */
const refKeyOf = (row) => String(row.legacyId || row.id);

/* Shared idempotent credit — used by BOTH the webhooks and the status-poll
   reconciliation so a missed webhook can never trap money in Pending.

   expectedAmount (optional) — STRICT AMOUNT MATCH for gateways whose
   callback amount must equal the local order (QwackPay). When the
   gateway-reported amount differs from the local order by ≥ ₹1 the credit
   is REFUSED: the deposit stays Pending for manual reconciliation and the
   admin gets a loud alert. A signature proves WHERE an event came from,
   not that its amount is safe to trust — order/amount binding is checked
   here. OKPay callers intentionally omit expectedAmount: its docs mandate
   crediting pay_money (what the user actually paid), which may legitimately
   differ from the order amount on partial payments. */
async function creditPayinDeposit(deposit, { qwackOrderId = "", utr = "", amount = null, expectedAmount = null }) {
  const amt = Number(amount) > 0 ? Number(amount) : Number(deposit.amount);
  const gwLabel = deposit.gatewayLabel || "Gateway";

  /* amount/order binding — never let a validly-signed event with a
     mismatched amount move money. Acknowledged ("success" is still
     replied) but left Pending so the admin order-query console settles it. */
  if (expectedAmount != null && Number(amount) > 0) {
    const diff = Math.abs(Number(amount) - Number(expectedAmount));
    if (diff >= 1) {
      audit.log(null, {
        actorType: "system",
        action: "gateway.payin_amount_mismatch",
        category: "gateway",
        target: deposit.phone,
        message:
          gwLabel + " AMOUNT MISMATCH — reported \u20B9" + amount +
          " vs order \u20B9" + expectedAmount + " for " + deposit.phone +
          " — NOT credited, manual reconciliation required",
        detail: {
          depositId: refKeyOf(deposit),
          reportedAmount: Number(amount),
          orderAmount: Number(expectedAmount),
          gateway: gwLabel,
        },
      });
      emitAdmin("txns:new", {
        type: "recharge",
        phone: deposit.phone,
        amount: Number(amount),
        message:
          "⚠ " + gwLabel + " AMOUNT MISMATCH for " + deposit.phone +
          " — reported \u20B9" + amount + ", order \u20B9" + expectedAmount +
          " — deposit left Pending, settle via order query",
      });
      return false;
    }
  }

  /* atomic claim — only the first processor wins the Pending → Success flip */
  const [claimed] = await Deposit.update(
    {
      status: "Success",
      processedAt: new Date(),
      gatewayOrderId: String(qwackOrderId || deposit.gatewayOrderId || ""),
      utr: String(utr || ""),
    },
    { where: { id: deposit.id, status: "Pending" } }
  );
  /* lost the idempotency race — another path already credited it */
  if (claimed === 0) return false;

  await User.update(
    {
      rechargeBalance: inc("recharge_balance", amt),
      totalRecharge: inc("total_recharge", amt),
    },
    { where: { id: deposit.user } }
  );
  await Transaction.update(
    { status: "Success", amount: amt },
    { where: { refId: refKeyOf(deposit), status: "Pending" } }
  );

  emitAdmin("txns:new", {
    type: "recharge",
    phone: deposit.phone,
    amount: amt,
    message:
      gwLabel + " payment SUCCESS — \u20B9" +
      amt +
      " credited for " +
      deposit.phone +
      (utr ? " (UTR " + utr + ")" : ""),
  });
  emitToUser(deposit.phone, "wallet:refresh", { reason: "deposit", status: "Success" });
  emitToUser(deposit.phone, "activity:update", { type: "recharge", status: "Success" });

  /* audit — system actor: the gateway webhook credited real money */
  audit.log(null, {
    actorType: "system",
    action: "gateway.payin_success",
    category: "gateway",
    target: deposit.phone,
    message:
      gwLabel + " credited \u20B9" + amt + " for " + deposit.phone +
      (utr ? " (UTR " + utr + ")" : ""),
    detail: { depositId: refKeyOf(deposit), amount: amt, gateway: gwLabel, utr },
  });
  return true;
}

/* Close a Pending deposit without crediting (gateway reported failure).
   Takes the deposit ROW so the ledger ref matches the string the row was
   written with (pre-migration ObjectId or the new numeric id). */
async function rejectPendingDeposit(deposit, phone, note) {
  await Deposit.update(
    { status: "Rejected", processedAt: new Date(), note },
    { where: { id: deposit.id, status: "Pending" } }
  );
  await Transaction.update(
    { status: "Rejected" },
    { where: { refId: refKeyOf(deposit), status: "Pending" } }
  );
  emitToUser(phone, "activity:update", { type: "recharge", status: "Rejected" });
}

/* ============ CREATE ORDER (shared factory) ============ */
async function createPayinForGateway(req, res, gw) {
  try {
    const amount = Math.floor(Number(req.body && req.body.amount));
    if (!amount || amount <= 0)
      return res
        .status(400)
        .json({ success: false, message: "Enter a valid amount" });

    const cfg = await gw.service.getConfig();
    if (!cfg.enabled)
      return res.status(403).json({
        success: false,
        message: "Online payment is currently unavailable — use the manual method",
      });
    if (!cfg.merchantId || !cfg.apiKey)
      return res.status(503).json({
        success: false,
        message: "Payment gateway is not configured yet — please try again later",
      });

    /* site limits (admin recharge setting) */
    const Setting = require("../models/Setting");
    const s = await Setting.getGlobal();
    const rc = (s && s.recharge) || {};
    const minR = Number(rc.minAmount) || 0;
    const maxR = Number(rc.maxAmount) || 0;
    if (minR && amount < minR)
      return res
        .status(400)
        .json({ success: false, message: "Minimum recharge is \u20B9" + minR });
    if (maxR && amount > maxR)
      return res
        .status(400)
        .json({ success: false, message: "Maximum recharge is \u20B9" + maxR });

    /* gateway hard limits */
    if (amount < gw.min || amount > gw.max)
      return res.status(400).json({
        success: false,
        message:
          "Amount must be between \u20B9" +
          gw.min +
          " and \u20B9" +
          gw.max,
      });
    /* webhook origin — saved publicUrls win; otherwise the public domain is
       detected from THIS request's proxy chain (fully automatic, zero setup:
       the user browses the site through the public domain, so that origin is
       exactly where the gateway's webhooks can reach) */
    const backendUrl =
      cfg.backendUrl || detectUrls(req).backendUrl || "";
    if (!backendUrl)
      return res.status(503).json({
        success: false,
        message:
          "Payment gateway callback URL is missing — ask the admin to save the Server URLs",
      });

    /* local order first — the deposit id doubles as the merchant order id */
    const deposit = await Deposit.create({
      user: req.user.id,
      userid: req.user.userid || "",
      phone: req.user.phone,
      amount,
      method: gw.label,
      status: "Pending",
      note: "Auto gateway order",
      gateway: gw.id,
    });

    const notifyUrl = backendUrl + gw.notifyPath;
    /* return target — saved → detected from this request → same origin as the
       webhooks (single-domain deploys) */
    const returnUrl =
      (cfg.clientUrl || detectUrls(req).clientUrl || backendUrl).replace(/\/+$/, "") +
      "/recharge?paid=" +
      refKeyOf(deposit);

    /* ledger entry — flips to Success when the webhook lands */
    await Transaction.create({
      user: req.user.id,
      userid: req.user.userid || "",
      phone: req.user.phone,
      type: "recharge",
      title: "Recharge",
      method: gw.label,
      amount,
      status: "Pending",
      refId: refKeyOf(deposit),
    });

    /* each service picks the fields it needs — extras are ignored */
    const r = await gw.service.createPayinOrder(cfg, {
      amount,
      orderId: refKeyOf(deposit),
      name: req.user.name || "Customer",
      phone: req.user.phone,
      /* QwackPay mandates an email — a per-user placeholder keeps the
         checkout happy without collecting PII we do not have */
      email: String(req.user.phone) + "@" + gw.emailDomain,
      notifyUrl,
      returnUrl,
    });

    if (!r.ok) {
      /* do not leave a dangling Pending order — mark it Rejected */
      await rejectPendingDeposit(
        deposit,
        req.user.phone,
        "Gateway: " + r.message
      );
      emitAdmin("txns:new", {
        type: "recharge",
        phone: req.user.phone,
        amount,
        message: gw.label + " order failed — \u20B9" + amount + " (" + r.message + ")",
      });
      return res.status(502).json({ success: false, message: r.message });
    }

    await Deposit.update(
      {
        gatewayOrderId: r.data.qwack_order_id || "",
        paymentUrl: r.data.payment_url || "",
      },
      { where: { id: deposit.id } }
    );

    emitAdmin("txns:new", {
      type: "recharge",
      phone: req.user.phone,
      amount,
      message:
        "New " + gw.label + " order — \u20B9" + amount + " from " + req.user.phone,
    });

    audit.log(req, {
      actorType: "user",
      actor: { id: req.user.id, label: req.user.phone },
      action: "gateway.order_created",
      category: "gateway",
      target: req.user.phone,
      message: gw.label + " payment order \u20B9" + amount + " started",
      detail: { depositId: refKeyOf(deposit), gateway: gw.id, amount },
    });

    res.json({
      success: true,
      message: "Payment order created",
      orderId: refKeyOf(deposit),
      paymentUrl: r.data.payment_url,
      amount,
    });
  } catch (e) {
    console.error(gw.id + " create error:", e.message);
    res.status(500).json({ success: false, message: "Server error, please try again" });
  }
}

/* gateway descriptors for the shared factory */
const CREATE_GWS = {
  qwackpay: {
    id: "qwackpay",
    label: "QwackPay",
    service: qwack,
    notifyPath: "/api/payments/qwackpay/notify",
    emailDomain: "qwackuser.com",
    min: GATEWAY_MIN,
    max: GATEWAY_MAX,
  },
  okpay: {
    id: "okpay",
    label: "OKPay",
    service: okpay,
    notifyPath: "/api/payments/okpay/notify",
    emailDomain: "okpayuser.com",
    min: GATEWAY_MIN,
    max: GATEWAY_MAX,
  },
};

/* ============ CREATE ORDER (user) ============ */
router.post("/qwackpay/create", userAuth, moneyRateLimit, async (req, res) =>
  createPayinForGateway(req, res, CREATE_GWS.qwackpay)
);
router.post("/okpay/create", userAuth, moneyRateLimit, async (req, res) =>
  createPayinForGateway(req, res, CREATE_GWS.okpay)
);

/* ============ QWACKPAY WEBHOOK (server-to-server, PUBLIC) ============
   QwackPay posts: { merchant_order_id, qwack_order_id, amount, status, utr, sign }
   MUST verify the MD5 sign, be idempotent, and answer literal text "success". */
router.post("/qwackpay/notify", async (req, res) => {
  try {
    const p = req.body || {};
    const cfg = await qwack.getConfig();

    /* verify signature — reject anything forged (401 per the docs) */
    const expected = qwack.generateSign(p, cfg.apiKey);
    if (!cfg.apiKey || expected !== String(p.sign || "").toUpperCase()) {
      return res.status(401).type("text/plain").send("invalid sign");
    }

    const orderId = String(p.merchant_order_id || "");
    const status = String(p.status || "").toLowerCase();
    if (!orderId)
      return res.status(400).type("text/plain").send("missing order");

    const deposit = await Deposit.findByAnyOrderId(orderId);
    if (!deposit)
      return res.status(404).type("text/plain").send("order not found");

    /* idempotency — success/failure is applied exactly once */
    if (deposit.status !== "Pending")
      return res.type("text/plain").send("success");

    if (status === "success") {
      deposit.gatewayLabel = "QwackPay";
      await creditPayinDeposit(deposit, {
        qwackOrderId: String(p.qwack_order_id || ""),
        utr: String(p.utr || ""),
        amount: Number(p.amount) > 0 ? Number(p.amount) : null,
        expectedAmount: deposit.amount, /* strict — QwackPay reports the order amount */
      });
    } else {
      /* failed / cancelled — close the order without crediting */
      await rejectPendingDeposit(
        deposit,
        deposit.phone,
        "Gateway reported: " + (status || "failed")
      );
    }

    /* the gateway re-sends notifications unless the body is exactly this */
    res.type("text/plain").send("success");
  } catch (e) {
    console.error("qwackpay notify error:", e.message);
    res.status(500).type("text/plain").send("error");
  }
});

/* ============ OKPAY PAYIN WEBHOOK (server-to-server, PUBLIC) ============
   OKPay posts urlencoded: { mchId, out_trade_no, currency, money, attach,
   pay_money, merchant_ratio, real_money, status(0/1/2), sign }.
   ⚠ THE AMOUNT CREDITED IS pay_money (actual user payment) — the docs
   demand it three times; falling back to money only when pay_money is
   missing/zero. Reply literal "success" — OKPay re-sends otherwise. */
router.post("/okpay/notify", async (req, res) => {
  try {
    const p = req.body || {};
    const cfg = await okpay.getConfig();

    /* verify signature — reject anything forged (401, same as QwackPay).
       OKPay signs LOWERCASE md5 and skips empty values + the sign field. */
    const expected = okpay.generateSign(p, cfg.apiKey);
    if (!cfg.apiKey || expected !== String(p.sign || "").toLowerCase()) {
      return res.status(401).type("text/plain").send("invalid sign");
    }

    const orderId = String(p.out_trade_no || "");
    const status = Number(p.status);
    if (!orderId)
      return res.status(400).type("text/plain").send("missing order");

    const deposit = await Deposit.findByAnyOrderId(orderId);
    if (!deposit)
      return res.status(404).type("text/plain").send("order not found");

    /* idempotency — success/failure is applied exactly once */
    if (deposit.status !== "Pending")
      return res.type("text/plain").send("success");

    if (status === 1) {
      /* THE RULE: credit pay_money, never money */
      const paid = Number(p.pay_money) > 0 ? Number(p.pay_money) : Number(p.money);
      deposit.gatewayLabel = "OKPay";
      await creditPayinDeposit(deposit, {
        qwackOrderId: deposit.gatewayOrderId || "",
        amount: paid > 0 ? paid : null,
      });
    } else if (status === 2) {
      await rejectPendingDeposit(
        deposit,
        deposit.phone,
        "Gateway reported: failed" +
          (Number(p.real_money) > 0 ? " (merchant revenue \u20B9" + p.real_money + ")" : "")
      );
    }
    /* status 0 (pending) → nothing yet, keep waiting */

    /* OKPay re-sends notifications unless the reply is exactly this */
    res.type("text/plain").send("success");
  } catch (e) {
    console.error("okpay notify error:", e.message);
    res.status(500).type("text/plain").send("error");
  }
});

/* ============ PAYOUT SETTLEMENT (shared by every gateway's webhook) ========== */
async function settlePayoutSuccess(wd, { gatewayOrderId = "", utr = "", label = "Gateway" }) {
  /* atomic claim — only ONE settlement path (webhook / admin query / manual)
     can flip a Pending/Processing withdrawal to Success; the loser of the
     race must not touch the ledger or push duplicate alerts */
  const [claimed] = await Withdrawal.update(
    {
      status: "Success",
      processedAt: new Date(),
      gatewayOrderId: String(gatewayOrderId || wd.gatewayOrderId || ""),
      utr: String(utr || ""),
      autoPayout: true,
    },
    { where: { id: wd.id, status: { [require("sequelize").Op.in]: ["Pending", "Processing"] } } }
  );
  if (claimed === 0) return false; /* already settled elsewhere */
  await Transaction.update(
    { status: "Success" },
    { where: { refId: refKeyOf(wd), status: { [require("sequelize").Op.ne]: "Success" } } }
  );
  emitAdmin("txns:new", {
    type: "withdraw",
    phone: wd.phone,
    amount: wd.amount,
    message:
      label + " auto payout SUCCESS — \u20B9" +
      (wd.netAmount || wd.amount) +
      " sent to " +
      wd.phone +
      (utr ? " (UTR " + utr + ")" : ""),
  });
  emitToUser(wd.phone, "wallet:refresh", { reason: "withdraw", status: "Success" });
  emitToUser(wd.phone, "activity:update", { type: "withdraw", status: "Success" });
  return true;
}

async function settlePayoutFailed(wd, { gatewayOrderId = "", note = "", label = "Gateway" }) {
  /* atomic claim — the refund below runs ONLY when THIS call won the claim.
     Without this guard a late "failed" webhook refunds the user a second
     time after the admin already rejected the request manually (free money
     out of the merchant balance). */
  const [claimed] = await Withdrawal.update(
    {
      status: "Rejected",
      processedAt: new Date(),
      gatewayOrderId: String(gatewayOrderId || wd.gatewayOrderId || ""),
      autoPayout: true,
      note,
    },
    { where: { id: wd.id, status: { [require("sequelize").Op.in]: ["Pending", "Processing"] } } }
  );
  if (claimed === 0) return false; /* settled elsewhere — NEVER refund again */
  /* refund the user's hold — same as the manual reject path in admin.js */
  await User.update({ balance: inc("balance", wd.amount) }, { where: { id: wd.user } });
  await Transaction.update(
    { status: "Rejected" },
    { where: { refId: refKeyOf(wd), status: { [require("sequelize").Op.ne]: "Rejected" } } }
  );
  emitAdmin("txns:new", {
    type: "withdraw",
    phone: wd.phone,
    amount: wd.amount,
    message:
      label + " auto payout FAILED — \u20B9" +
      wd.amount +
      " refunded to " +
      wd.phone,
  });
  emitToUser(wd.phone, "wallet:refresh", { reason: "withdraw", status: "Rejected" });
  emitToUser(wd.phone, "activity:update", { type: "withdraw", status: "Rejected" });
  return true;
}

/* ============ QWACKPAY PAYOUT WEBHOOK (server-to-server, PUBLIC) ============
   QwackPay posts the final payout result here:
   { merchant_order_id, qwack_order_id, amount, status, utr, sign }
   - success → the withdrawal flips to Success (money sent to the bank)
   - failed  → the withdrawal flips to Rejected and the user is refunded
   Same signature rules / idempotency / literal "success" reply as the payin. */
router.post("/qwackpay/payout-notify", async (req, res) => {
  try {
    const p = req.body || {};
    const cfg = await qwack.getConfig();

    /* verify signature — reject anything forged (401 per the docs) */
    const expected = qwack.generateSign(p, cfg.apiKey);
    if (!cfg.apiKey || expected !== String(p.sign || "").toUpperCase()) {
      return res.status(401).type("text/plain").send("invalid sign");
    }

    /* the exact merchant order_id we sent on /payout/create; legacy ids and
       the raw numeric id are also accepted so callbacks never get lost */
    const orderId = String(p.merchant_order_id || "");
    const wd = await Withdrawal.findByAnyPayoutOrderId(orderId);
    if (!wd)
      return res.status(404).type("text/plain").send("order not found");

    /* idempotency — a settled payout is never applied twice */
    if (wd.status === "Success" || wd.status === "Rejected")
      return res.type("text/plain").send("success");

    const status = String(p.status || "").toLowerCase();

    if (status === "success") {
      await settlePayoutSuccess(wd, {
        gatewayOrderId: String(p.qwack_order_id || ""),
        utr: String(p.utr || ""),
        label: "QwackPay",
      });
    } else {
      await settlePayoutFailed(wd, {
        gatewayOrderId: String(p.qwack_order_id || ""),
        note: "Gateway reported: " + (status || "failed"),
        label: "QwackPay",
      });
    }

    /* the gateway re-sends notifications unless the body is exactly this */
    res.type("text/plain").send("success");
  } catch (e) {
    console.error("qwackpay payout-notify error:", e.message);
    res.status(500).type("text/plain").send("error");
  }
});

/* ============ OKPAY PAYOUT WEBHOOK (server-to-server, PUBLIC) ============
   OKPay posts urlencoded: { mchId, out_trade_no, currency, money, attach,
   merchant_ratio, real_money, status(0/1/2), sign }.
   - status 1 → withdrawal Success (money sent to the bank)
   - status 2 → withdrawal Rejected + instant refund to the user's wallet
   Same idempotency / literal "success" reply as the payin webhook. */
router.post("/okpay/payout-notify", async (req, res) => {
  try {
    const p = req.body || {};
    const cfg = await okpay.getConfig();

    /* verify signature — reject anything forged */
    const expected = okpay.generateSign(p, cfg.apiKey);
    if (!cfg.apiKey || expected !== String(p.sign || "").toLowerCase()) {
      return res.status(401).type("text/plain").send("invalid sign");
    }

    const orderId = String(p.out_trade_no || "");
    const wd = await Withdrawal.findByAnyPayoutOrderId(orderId);
    if (!wd)
      return res.status(404).type("text/plain").send("order not found");

    /* idempotency — a settled payout is never applied twice */
    if (wd.status === "Success" || wd.status === "Rejected")
      return res.type("text/plain").send("success");

    const status = Number(p.status);
    if (status === 1) {
      await settlePayoutSuccess(wd, { label: "OKPay" });
    } else if (status === 2) {
      await settlePayoutFailed(wd, {
        note: "Gateway reported: failed",
        label: "OKPay",
      });
    }
    /* status 0 (pending) → nothing yet, keep waiting */

    /* OKPay re-sends notifications unless the reply is exactly this */
    res.type("text/plain").send("success");
  } catch (e) {
    console.error("okpay payout-notify error:", e.message);
    res.status(500).type("text/plain").send("error");
  }
});

/* ============ ORDER STATUS POLL (user — return page banner) ============
   If the deposit is still Pending this RECONCILES with the gateway
   (query order → credit on success) so a missed webhook (wrong backend
   URL, network hiccup) can never trap money. */
router.get("/qwackpay/status/:orderId", userAuth, async (req, res) => {
  try {
    let d = await pollDeposit(req.params.orderId, req.user.id, qwack, "QwackPay");
    if (!d) return res.status(404).json({ success: false, message: "Order not found" });
    res.json({
      success: true,
      order: {
        id: refKeyOf(d),
        amount: d.amount,
        status: d.status,
        utr: d.utr || "",
      },
    });
  } catch (e) {
    res.status(500).json({ success: false, message: "Failed to load order" });
  }
});

router.get("/okpay/status/:orderId", userAuth, async (req, res) => {
  try {
    let d = await pollDeposit(req.params.orderId, req.user.id, okpay, "OKPay");
    if (!d) return res.status(404).json({ success: false, message: "Order not found" });
    res.json({
      success: true,
      order: {
        id: refKeyOf(d),
        amount: d.amount,
        status: d.status,
        utr: d.utr || "",
      },
    });
  } catch (e) {
    res.status(500).json({ success: false, message: "Failed to load order" });
  }
});

/* shared reconciliation logic — okpay credits by pay_money (the docs rule);
   qwackpay passes expectedAmount so the gateway amount is strictly matched */
async function pollDeposit(orderId, userId, service, label) {
  let d = await Deposit.findByAnyOrderId(orderId);
  if (!d || Number(d.user) !== Number(userId)) return null;

  /* missed-webhook reconciliation — any gateway order still Pending.
     (gatewayOrderId is NOT required: both gateways accept the merchant
     order id — the local deposit id — so orders created before the
     gateway echoed its own id still reconcile instead of trapping money.) */
  if (d.status === "Pending" && d.gateway) {
    const cfg = await service.getConfig();
    if (cfg.enabled && cfg.merchantId && cfg.apiKey) {
      const r = await service.queryOrder(cfg, refKeyOf(d), "payin");
      if (r.ok) {
        const g = String((r.data && r.data.status) || "").toLowerCase();
        if (g === "success" || g === "completed" || g === "paid") {
          /* OKPay rule — the paid basis is pay_money when present */
          const paid =
            Number(r.data && r.data.pay_money) > 0
              ? Number(r.data.pay_money)
              : Number(r.data && r.data.amount) > 0
              ? Number(r.data.amount)
              : null;
          const fresh = await Deposit.findByPk(d.id);
          fresh.gatewayLabel = label;
          await creditPayinDeposit(fresh, {
            qwackOrderId: String((r.data && r.data.qwack_order_id) || d.gatewayOrderId),
            utr: String((r.data && r.data.utr) || ""),
            amount: paid,
            expectedAmount: label === "QwackPay" ? d.amount : null,
          });
          d = await Deposit.findByPk(d.id);
        } else if (g === "failed" || g === "cancelled" || g === "rejected") {
          await rejectPendingDeposit(d, d.phone, "Gateway reported: " + g);
          d = await Deposit.findByPk(d.id);
        }
      }
    }
  }
  return d;
}

module.exports = router;
module.exports.creditPayinDeposit = creditPayinDeposit; /* reused by the admin order-query tool */
