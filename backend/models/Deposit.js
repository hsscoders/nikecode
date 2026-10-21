const { sequelize, Sequelize } = require("../db");

const Deposit = sequelize.define(
  "Deposit",
  {
    id: { type: Sequelize.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
    legacyId: { type: Sequelize.CHAR(24), field: "legacy_id" },
    user: { type: Sequelize.INTEGER.UNSIGNED, field: "user_id" },
    userid: { type: Sequelize.STRING(20), defaultValue: "" },
    phone: { type: Sequelize.STRING(10), defaultValue: "" },
    amount: { type: Sequelize.DECIMAL(12, 2), defaultValue: 0 },
    method: { type: Sequelize.STRING(40), defaultValue: "Pay-T" },
    status: {
      type: Sequelize.ENUM("Pending", "Success", "Rejected"),
      defaultValue: "Pending",
    },
    note: { type: Sequelize.STRING(255), defaultValue: "" },
    processedAt: { type: Sequelize.DATE, field: "processed_at" },
    gateway: { type: Sequelize.STRING(40), defaultValue: "" },
    gatewayOrderId: { type: Sequelize.STRING(64), defaultValue: "", field: "gateway_order_id" },
    paymentUrl: { type: Sequelize.STRING(500), defaultValue: "", field: "payment_url" },
    utr: { type: Sequelize.STRING(64), defaultValue: "" },
  },
  { tableName: "deposits", underscored: true }
);

/* Resolve a gateway merchant order id → Deposit.
   New orders carry the numeric MySQL id; every order that existed before
   the MongoDB→MySQL migration carries the old 24-char ObjectId as its
   merchant_order_id, so webhooks/queries for pre-migration Pending
   orders keep resolving (via legacy_id) instead of getting lost. */
Deposit.findByAnyOrderId = async function (orderId) {
  const s = String(orderId || "").trim();
  if (!s) return null;
  if (/^[0-9a-fA-F]{24}$/.test(s)) {
    const legacy = await Deposit.findOne({ where: { legacyId: s } });
    if (legacy) return legacy;
  }
  if (!/^\d+$/.test(s)) return null;
  return Deposit.findByPk(Number(s));
};

module.exports = Deposit;
