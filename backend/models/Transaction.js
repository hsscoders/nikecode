const { sequelize, Sequelize } = require("../db");

/* Unified wallet ledger — recharge, withdraw, invite commission and daily
   plan income. (`ref_id` links the row to its Deposit/Withdrawal id —
   either the numeric id or the pre-migration ObjectId string.) */
const Transaction = sequelize.define(
  "Transaction",
  {
    id: { type: Sequelize.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
    legacyId: { type: Sequelize.CHAR(24), field: "legacy_id" },
    user: { type: Sequelize.INTEGER.UNSIGNED, field: "user_id" },
    userid: { type: Sequelize.STRING(20), defaultValue: "" },
    phone: { type: Sequelize.STRING(10), defaultValue: "" },
    type: {
      type: Sequelize.ENUM("recharge", "withdraw", "commission", "income", "bonus", "invest"),
      defaultValue: "recharge",
    },
    title: { type: Sequelize.STRING(60), defaultValue: "" },
    method: { type: Sequelize.STRING(120), defaultValue: "" },
    amount: { type: Sequelize.DECIMAL(12, 2), defaultValue: 0 },
    chargePercent: { type: Sequelize.DECIMAL(5, 2), defaultValue: 0, field: "charge_percent" },
    charge: { type: Sequelize.DECIMAL(12, 2), defaultValue: 0 },
    netAmount: { type: Sequelize.DECIMAL(12, 2), defaultValue: 0, field: "net_amount" },
    status: {
      /* 'Processing' exists because the auto-payout flow flips the ledger
         entry while the gateway order is in flight (Mongoose never enforced
         enums on updateMany — the data really contains it) */
      type: Sequelize.ENUM("Pending", "Processing", "Success", "Rejected"),
      defaultValue: "Pending",
    },
    refId: { type: Sequelize.STRING(64), defaultValue: "", field: "ref_id" },
  },
  { tableName: "transactions", underscored: true }
);

module.exports = Transaction;
