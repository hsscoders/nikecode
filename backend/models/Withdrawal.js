const { sequelize, Sequelize } = require("../db");

const Withdrawal = sequelize.define(
  "Withdrawal",
  {
    id: { type: Sequelize.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
    legacyId: { type: Sequelize.CHAR(24), field: "legacy_id" },
    user: { type: Sequelize.INTEGER.UNSIGNED, field: "user_id" },
    userid: { type: Sequelize.STRING(20), defaultValue: "" },
    phone: { type: Sequelize.STRING(10), defaultValue: "" },
    amount: { type: Sequelize.DECIMAL(12, 2), defaultValue: 0 },
    chargePercent: { type: Sequelize.DECIMAL(5, 2), defaultValue: 0, field: "charge_percent" },
    charge: { type: Sequelize.DECIMAL(12, 2), defaultValue: 0 },
    netAmount: { type: Sequelize.DECIMAL(12, 2), defaultValue: 0, field: "net_amount" },
    realName: { type: Sequelize.STRING(30), defaultValue: "", field: "real_name" },
    bankName: { type: Sequelize.STRING(30), defaultValue: "", field: "bank_name" },
    account: { type: Sequelize.STRING(24), defaultValue: "" },
    ifsc: { type: Sequelize.STRING(11), defaultValue: "" },
    status: {
      type: Sequelize.ENUM("Pending", "Processing", "Success", "Rejected"),
      defaultValue: "Pending",
    },
    note: { type: Sequelize.STRING(255), defaultValue: "" },
    processedAt: { type: Sequelize.DATE, field: "processed_at" },
    autoPayout: { type: Sequelize.BOOLEAN, defaultValue: false, field: "auto_payout" },
    gateway: { type: Sequelize.STRING(40), defaultValue: "" },
    payoutOrderId: { type: Sequelize.STRING(64), defaultValue: "", field: "payout_order_id" },
    gatewayOrderId: { type: Sequelize.STRING(64), defaultValue: "", field: "gateway_order_id" },
    utr: { type: Sequelize.STRING(64), defaultValue: "" },
  },
  { tableName: "withdrawals", underscored: true }
);

/* Gateway payout callbacks address the withdrawal by the merchant payout
   order id (WD…), the raw numeric id, or the pre-migration ObjectId. */
Withdrawal.findByAnyPayoutOrderId = async function (orderId) {
  const s = String(orderId || "").trim();
  if (!s) return null;
  const byPayout = await Withdrawal.findOne({ where: { payoutOrderId: s } });
  if (byPayout) return byPayout;
  if (/^[0-9a-fA-F]{24}$/.test(s)) {
    const legacy = await Withdrawal.findOne({ where: { legacyId: s } });
    if (legacy) return legacy;
  }
  if (!/^\d+$/.test(s)) return null;
  return Withdrawal.findByPk(Number(s));
};

module.exports = Withdrawal;
