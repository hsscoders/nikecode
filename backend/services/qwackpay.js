const crypto = require("crypto");
const Setting = require("../models/Setting");

/* ============ QWACKPAY AUTO PAYMENT GATEWAY SERVICE ============
   Implements the QwackPay India API (payin) used by the /recharge page.
   Docs source: the merchant integration guide (integtion.txt).

   - Every request body is MD5-signed: ASCII-sorted "k=v&..." params
     (sign + empty values excluded) + "&key=API_KEY", md5 → UPPERCASE.
   - The API key lives ONLY in the DB settings (Admin → Payment Gateway)
     and never leaves the backend.
   - All calls are POST with JSON bodies and an X-API-Key header.        */

const DEFAULT_BASE = "https://qwackpay.com/api/v1";

/* Read the gateway config saved by the admin (fallbacks keep it usable
   even if the settings row predates the qwackpay section — getGlobal()
   deep-merges the schema defaults, mirroring the old Mongoose behaviour) */
async function getConfig() {
  const s = await Setting.getGlobal();
  const q = (s && s.qwackpay) || {};
  /* per-gateway override → global auto-detected publicUrls (saved once in
     Admin → Payment Gateway → Server & Webhooks) → empty */
  const pub = (s && s.publicUrls) || {};
  return {
    enabled: !!q.enabled,
    autoPayout: !!q.autoPayout,
    merchantId: String(q.merchantId || ""),
    apiKey: String(q.apiKey || ""),
    baseUrl: String(q.baseUrl || DEFAULT_BASE).replace(/\/+$/, "") || DEFAULT_BASE,
    backendUrl: String(q.backendUrl || pub.backendUrl || "").replace(/\/+$/, ""),
    clientUrl: String(q.clientUrl || pub.clientUrl || "").replace(/\/+$/, ""),
  };
}

/* MD5 signature — same algorithm the gateway uses to sign webhooks */
function generateSign(params, apiKey) {
  const signStr =
    Object.entries(params)
      .filter(
        ([k, v]) =>
          k !== "sign" && v !== "" && v !== null && v !== undefined
      )
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)) // ASCII ascending
      .map(([k, v]) => `${k}=${typeof v === "object" ? JSON.stringify(v) : v}`)
      .join("&") + `&key=${apiKey}`;
  return crypto
    .createHash("md5")
    .update(signStr, "utf8")
    .digest("hex")
    .toUpperCase();
}

/* Shared POST helper — returns { ok, code, data, message } */
async function post(cfg, path, body) {
  const sign = generateSign(body, cfg.apiKey);
  const payload = { ...body, sign };
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20000);
  try {
    const res = await fetch(cfg.baseUrl + path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": cfg.apiKey,
      },
      body: JSON.stringify(payload),
      signal: ctrl.signal,
    });
    let json = null;
    try {
      json = await res.json();
    } catch (e) {
      json = null;
    }
    if (!json) {
      return {
        ok: false,
        code: res.status,
        message: "Gateway returned an invalid response (" + res.status + ")",
      };
    }
    /* Envelope: { code: 200, message, data } */
    if (json.code !== 200) {
      return {
        ok: false,
        code: json.code || res.status,
        message: json.message || "Gateway request failed",
      };
    }
    return { ok: true, code: 200, data: json.data || {}, message: json.message };
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

/* Create a payin (collection) order — returns { payment_url, ... } */
async function createPayinOrder(cfg, { amount, orderId, name, phone, email, notifyUrl, returnUrl }) {
  const body = {
    merchant_id: cfg.merchantId,
    amount: Number(amount),
    order_id: String(orderId),
    customer_name: String(name || "Customer"),
    customer_phone: String(phone),
    customer_email: String(email),
    notify_url: notifyUrl || undefined,
    return_url: returnUrl || undefined,
  };
  const r = await post(cfg, "/order/create", body);
  if (!r.ok) return r;
  if (!r.data || !r.data.payment_url) {
    return { ok: false, code: 500, message: "Gateway did not return a payment URL" };
  }
  return r;
}

/* Query an order status (reconciliation / status polling).
   Works for both payin and payout orders (merchant order_id). */
async function queryOrder(cfg, orderId) {
  return post(cfg, "/order/query", {
    merchant_id: cfg.merchantId,
    order_id: String(orderId),
  });
}

/* Query the merchant wallet balance (admin "Test connection" + balance checker) */
async function queryBalance(cfg) {
  return post(cfg, "/balance", { merchant_id: cfg.merchantId });
}

/* Create a payout (disbursement) order — sends money from the merchant
   balance to an Indian bank account. Requires:
   - the server IP whitelisted in the merchant dashboard (403 otherwise)
   - amount ₹100 – ₹100,000
   Returns { qwack_order_id, merchant_order_id, amount, fee, status:"processing" } */
async function createPayoutOrder(cfg, { amount, orderId, accountNo, ifsc, userName, phone, email, notifyUrl }) {
  const body = {
    merchant_id: cfg.merchantId,
    amount: Number(amount),
    order_id: String(orderId),
    account_no: String(accountNo),
    ifsc: String(ifsc).toUpperCase(),
    user_name: String(userName),
    phone: String(phone),
    email: String(email),
    notify_url: notifyUrl || undefined,
  };
  const r = await post(cfg, "/payout/create", body);
  if (!r.ok) return r;
  if (!r.data || !r.data.qwack_order_id) {
    /* some gateways answer 200 without data on soft failures — treat as error */
    return { ok: false, code: 500, message: "Gateway did not confirm the payout order" };
  }
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
