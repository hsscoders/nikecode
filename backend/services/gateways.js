const qwack = require("./qwackpay");
const okpay = require("./okpay");
const Setting = require("../models/Setting");

/* ============ AUTOMATIC PAYMENT GATEWAY REGISTRY ============
   Every integrated automatic gateway registers ONE entry here. The rest of
   the system is registry-driven, so plugging in the next gateway (Razorpay,
   Cashfree, PhonePe, USDT…) needs NO changes to the admin routes, the
   withdrawals page or the payout flow:

     1. add a service file (e.g. services/razorpay.js) with the same surface:
        getConfig(), createPayinOrder(cfg, params), createPayoutOrder(cfg,
        params), queryOrder(cfg, id, kind), queryBalance(cfg) — and the
        QWACK DIALECT for responses (payment_url / qwack_order_id /
        status "pending|success|failed" / available_balance), see okpay.js
     2. add its credentials section to the Setting model + admin settings PUT
     3. add one entry to REGISTRY below

   Everything else — the Admin → Withdrawals gateway menu, per-gateway
   balances, default payout gateway, order status query — picks it up
   automatically. */

const REGISTRY = {
  qwackpay: {
    id: "qwackpay",
    label: "QwackPay",
    /* webhook paths are gateway-specific — appended to the saved backendUrl */
    notifyPath: "/api/payments/qwackpay/notify",
    payoutNotifyPath: "/api/payments/qwackpay/payout-notify",
    getCfg: () => qwack.getConfig(),
    createPayoutOrder: (cfg, params) => qwack.createPayoutOrder(cfg, params),
    /* kind: "payin" | "payout" | "auto" — QwackPay has ONE query endpoint
       for both order kinds, so the hint is ignored */
    queryOrder: (cfg, orderId) => qwack.queryOrder(cfg, orderId),
    queryBalance: (cfg) => qwack.queryBalance(cfg),
    /* normalise the raw /balance payload for the admin UI */
    parseBalance: (d) => ({
      available: Number(d && (d.available_balance ?? 0)) || 0,
      frozen: Number(d && (d.frozen_balance ?? 0)) || 0,
      total: Number(d && (d.total_balance ?? 0)) || 0,
    }),
  },
  okpay: {
    id: "okpay",
    label: "OKPay",
    notifyPath: "/api/payments/okpay/notify",
    payoutNotifyPath: "/api/payments/okpay/payout-notify",
    getCfg: () => okpay.getConfig(),
    createPayoutOrder: (cfg, params) => okpay.createPayoutOrder(cfg, params),
    /* OKPay splits payin/payout queries across /v1/Query/Collect and
       /v1/Query/Payout — the kind hint routes them ("auto" tries both) */
    queryOrder: (cfg, orderId, kind) => okpay.queryOrder(cfg, orderId, kind),
    queryBalance: (cfg) => okpay.queryBalance(cfg),
    parseBalance: (d) => ({
      available: Number(d && (d.available_balance ?? 0)) || 0,
      frozen: Number(d && (d.frozen_balance ?? 0)) || 0,
      total: Number(d && (d.total_balance ?? 0)) || 0,
    }),
  },
};

/* Can this gateway push money right now? (enabled + auto payout + credentials)
   backendUrl is intentionally NOT required here — the payout route detects the
   public domain from the admin's request when nothing is saved (auto URLs). */
async function payoutReady(entry) {
  try {
    const cfg = await entry.getCfg();
    return !!(
      cfg.enabled &&
      cfg.autoPayout &&
      cfg.merchantId &&
      cfg.apiKey
    );
  } catch (e) {
    return false;
  }
}

/* Admin → Withdrawals gateway menu payload:
   [{ id, label, ready, default, balance: {available,frozen,total} | null }]
   Balances are fetched in parallel — a dead gateway never blocks the page
   (allSettled + its own timeout inside the service). */
async function listPayoutGateways() {
  const s = await Setting.findOne({ key: "global" }).lean();
  const prefs = (s && s.gatewayPrefs) || {};
  const defaultGw = String(prefs.defaultPayoutGateway || "qwackpay");

  const out = await Promise.all(
    Object.values(REGISTRY).map(async (entry) => {
      const ready = await payoutReady(entry);
      let balance = null;
      if (ready) {
        try {
          const cfg = await entry.getCfg();
          const r = await entry.queryBalance(cfg);
          if (r.ok) balance = entry.parseBalance(r.data);
        } catch (e) {
          balance = null;
        }
      }
      return {
        id: entry.id,
        label: entry.label,
        ready,
        isDefault: entry.id === defaultGw,
        balance,
      };
    })
  );
  /* the admin's default gateway first, then the rest alphabetically */
  return out.sort((a, b) => (b.isDefault ? 1 : 0) - (a.isDefault ? 1 : 0) || a.label.localeCompare(b.label));
}

/* Resolve a gateway entry by id — falls back to QwackPay for unknown ids so
   older clients / retries never break */
function getGateway(id) {
  return REGISTRY[String(id || "qwackpay")] || REGISTRY.qwackpay;
}

module.exports = { REGISTRY, listPayoutGateways, getGateway, payoutReady };
