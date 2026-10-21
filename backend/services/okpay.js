const crypto = require("crypto");
const Setting = require("../models/Setting");

/* ============ OKPAY AUTO PAYMENT GATEWAY SERVICE (wpay.one) ============
   Implements the OKPay India API — payin (Collect), payout, balance and
   order queries. Docs source: the merchant Postman collection
   (documenter.getpostman.com/view/29742823/2sBYB1PUJU).

   Protocol rules (from the official docs):
   - POST + application/x-www-form-urlencoded, UTF-8.
   - Signature: params sorted by ASCII (lexicographic), EMPTY values and the
     sign field excluded, joined "k1=v1&k2=v2…" + "&key=<private key>",
     MD5 → LOWERCASE (QwackPay signs uppercase — do not mix them up).
   - Envelope: { code, msg, data } — code 0 = success, 5 = sign error,
     6 = duplicate order, 7 = order not found, 9 = insufficient balance,
     16 = IP not whitelisted. Order status: 0 pending, 1 success, 2 failed.
   - The gateway does NOT de-duplicate merchant order numbers — we keep them
     unique on our side (deposit ids + retry-suffixed payout ids).
   - ⚠ CRITICAL (per the docs, repeated 3×): on the payin callback the
     USER BALANCE MUST BE CREDITED BY `pay_money` (what the user actually
     paid), never by `money`. Handled in the okpay/notify route.

   DIALECT NOTE (multi-gateway contract): the responses are normalised here
   to the same field names the QwackPay integration taught the rest of the
   system to speak, so payments.js / admin.js / gateways.js need no change
   per gateway:
     createPayinOrder  → data.payment_url, data.qwack_order_id
     createPayoutOrder → data.qwack_order_id
     queryOrder        → data.status = "pending" | "success" | "failed",
                         data.qwack_order_id, data.amount, data.pay_money
     queryBalance      → data.available_balance / frozen_balance /
                         total_balance                                  */

const DEFAULT_BASE = "https://api.wpay.one";

/* Read the gateway config saved by the admin. Backend/Website URLs fall back
   to the global auto-detected publicUrls (saved once in Admin → Payment
   Gateway → Server & Webhooks) so no per-gateway URL typing is needed.
   getGlobal() deep-merges schema defaults (old Mongoose behaviour). */
async function getConfig() {
  const s = await Setting.getGlobal();
  const o = (s && s.okpay) || {};
  const qw = (s && s.qwackpay) || {};
  /* per-gateway override → global auto-detected publicUrls → legacy
     QwackPay fields (very old settings docs) → empty */
  const pub = (s && s.publicUrls) || {};
  return {
    enabled: !!o.enabled,
    autoPayout: !!o.autoPayout,
    displayName: String(o.displayName || "OKPay"),
    mchId: String(o.mchId || ""),
    merchantId: String(o.mchId || ""), /* registry alias (payoutReady checks it) */
    apiKey: String(o.apiKey || ""),
    baseUrl: String(o.baseUrl || DEFAULT_BASE).replace(/\/+$/, "") || DEFAULT_BASE,
    backendUrl: String(o.backendUrl || pub.backendUrl || qw.backendUrl || "").replace(/\/+$/, ""),
    clientUrl: String(o.clientUrl || pub.clientUrl || qw.clientUrl || "").replace(/\/+$/, ""),
  };
}

/* MD5 signature — lowercase, empty values + sign excluded, ASCII-sorted */
function generateSign(params, apiKey) {
  const signStr =
    Object.entries(params)
      .filter(
        ([k, v]) =>
          k !== "sign" && v !== "" && v !== null && v !== undefined
      )
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)) // ASCII ascending
      .map(([k, v]) => `${k}=${v}`)
      .join("&") + `&key=${apiKey}`;
  return crypto
    .createHash("md5")
    .update(signStr, "utf8")
    .digest("hex")
    .toLowerCase();
}

/* Numeric order status → the normalised string the rest of the system uses */
function normStatus(v) {
  const n = Number(v);
  if (n === 1) return "success";
  if (n === 2) return "failed";
  return "pending";
}

/* Shared POST helper — urlencoded body, { code, msg, data } envelope.
   Returns { ok, code, data, message } (code = the gateway's business code). */
async function post(cfg, path, params) {
  const sign = generateSign(params, cfg.apiKey);
  const payload = new URLSearchParams({ ...params, sign });
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20000);
  try {
    const res = await fetch(cfg.baseUrl + path, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: payload.toString(),
      signal: ctrl.signal,
    });
    let json = null;
    try {
      json = await res.json();
    } catch (e) {
      json = null;
    }
    if (!json || typeof json.code === "undefined") {
      return {
        ok: false,
        code: res.status,
        message: "Gateway returned an invalid response (" + res.status + ")",
      };
    }
    if (Number(json.code) !== 0) {
      return {
        ok: false,
        code: Number(json.code),
        message: okpayCodeMessage(Number(json.code), json.msg),
      };
    }
    return { ok: true, code: 0, data: json.data || {}, message: json.msg };
  } catch (e) {
    return {
      ok: false,
      code: 0,
      message:
        e.name === "AbortError"
          ? "Gateway timeout — please try again"
          : "Gateway unreachable — please try again",
    };
  } finally {
    clearTimeout(timer);
  }
}

/* Business codes from the official docs — plain-English admin messages */
function okpayCodeMessage(code, fallback) {
  const map = {
    1: "Gateway rejected the request",
    2: "Merchant ID (mchId) is wrong",
    3: "Merchant account does not exist",
    4: "Merchant account is abnormal",
    5: "Signature error — check the gateway key",
    6: "Order already exists",
    7: "Order does not exist",
    8: "No permission for this operation",
    9: "Insufficient gateway balance",
    10: "Wrong amount",
    11: "Payment channel is under maintenance",
    12: "Currency does not exist",
    13: "Payment channel does not exist",
    15: "Channel failure — try again or use another gateway",
    16: "IP not whitelisted — add this server's IP in the OKPay dashboard",
    17: "Bank does not exist",
  };
  return map[code] || fallback || "Gateway request failed (code " + code + ")";
}

/* ============ CREATE PAYIN ORDER (/v1/Collect) ============
   UPI hosted checkout. money must be an INTEGER per the docs.
   Normalised result: data.payment_url + data.qwack_order_id. */
async function createPayinOrder(cfg, { amount, orderId, notifyUrl, returnUrl }) {
  const body = {
    mchId: String(cfg.mchId || cfg.merchantId),
    currency: "INR",
    out_trade_no: String(orderId),
    pay_type: "UPI",
    money: String(Math.floor(Number(amount))),
    notify_url: notifyUrl || undefined,
    returnUrl: returnUrl || undefined,
  };
  const r = await post(cfg, "/v1/Collect", body);
  if (!r.ok) return r;
  if (!r.data || !r.data.url) {
    return { ok: false, code: 500, message: "Gateway did not return a payment URL" };
  }
  /* dialect normalisation for the shared payment flow */
  r.data.payment_url = String(r.data.url);
  r.data.qwack_order_id = String(r.data.transaction_Id || "");
  return r;
}

/* ============ QUERY ORDER ============
   OKPay splits payin / payout queries across two endpoints:
   kind "payin" → /v1/Query/Collect, "payout" → /v1/Query/Payout,
   "auto" → try Collect first, fall back to Payout when the order is not
   found there (code 7) — the admin order-query console uses "auto" because
   a pasted id can be either kind. */
async function queryOrder(cfg, orderId, kind = "auto") {
  const params = {
    mchId: String(cfg.mchId || cfg.merchantId),
    out_trade_no: String(orderId),
  };
  if (kind === "payout") return queryPayout(cfg, params);
  if (kind === "payin") return queryCollect(cfg, params);
  const r = await queryCollect(cfg, params);
  if (r.ok || r.code !== 7) return r;
  return queryPayout(cfg, params);
}

async function queryCollect(cfg, params) {
  const r = await post(cfg, "/v1/Query/Collect", params);
  if (!r.ok) return r;
  const d = r.data || {};
  r.data = {
    ...d,
    status: normStatus(d.status),
    qwack_order_id: String(d.transaction_Id || ""),
    amount: Number(d.money) || 0,
    pay_money: Number(d.pay_money) || 0,
  };
  return r;
}

async function queryPayout(cfg, params) {
  const r = await post(cfg, "/v1/Query/Payout", params);
  if (!r.ok) return r;
  const d = r.data || {};
  r.data = {
    ...d,
    status: normStatus(d.status),
    qwack_order_id: String(d.transaction_Id || ""),
    amount: Number(d.money) || 0,
  };
  return r;
}

/* ============ QUERY BALANCE (/v1/balance) ============
   Response data.Balance = [{ code: "INR", balance: 99892.5 }] — normalised
   to the shared available/frozen/total shape. */
async function queryBalance(cfg) {
  const r = await post(cfg, "/v1/balance", {
    mchId: String(cfg.mchId || cfg.merchantId),
    currency: "INR",
  });
  if (!r.ok) return r;
  const list = Array.isArray(r.data && r.data.Balance) ? r.data.Balance : [];
  const inr = list.find((x) => String(x.code).toUpperCase() === "INR") || list[0] || {};
  const bal = Number(inr.balance) || 0;
  r.data = {
    ...(r.data || {}),
    available_balance: bal,
    frozen_balance: 0,
    total_balance: bal,
  };
  return r;
}

/* ============ CREATE PAYOUT ORDER (/v1/Payout) ============
   Sends money to an Indian bank account (pay_type BANK, IFSC in reserve1).
   The server IP must be whitelisted in the OKPay dashboard (code 16).
   Normalised result: data.qwack_order_id. */
async function createPayoutOrder(cfg, { amount, orderId, accountNo, ifsc, userName, notifyUrl }) {
  const body = {
    mchId: String(cfg.mchId || cfg.merchantId),
    currency: "INR",
    out_trade_no: String(orderId),
    pay_type: "BANK",
    account: String(accountNo),
    userName: String(userName),
    money: String(Number(amount)),
    reserve1: String(ifsc).toUpperCase(),
    notify_url: notifyUrl || undefined,
  };
  const r = await post(cfg, "/v1/Payout", body);
  if (!r.ok) return r;
  if (!r.data || !r.data.transaction_Id) {
    return { ok: false, code: 500, message: "Gateway did not confirm the payout order" };
  }
  /* dialect normalisation for the shared auto-payout flow */
  r.data.qwack_order_id = String(r.data.transaction_Id);
  return r;
}

module.exports = {
  getConfig,
  generateSign,
  createPayinOrder,
  queryOrder,
  queryBalance,
  createPayoutOrder,
};
