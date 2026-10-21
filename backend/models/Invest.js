const { sequelize, Sequelize } = require("../db");

const Invest = sequelize.define(
  "Invest",
  {
    id: { type: Sequelize.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
    legacyId: { type: Sequelize.CHAR(24), field: "legacy_id" },
    user: { type: Sequelize.INTEGER.UNSIGNED, field: "user_id" },
    userid: { type: Sequelize.STRING(20), defaultValue: "" },
    phone: { type: Sequelize.STRING(10), defaultValue: "" },
    planId: { type: Sequelize.INTEGER.UNSIGNED, field: "plan_id" },
    planName: { type: Sequelize.STRING(60), field: "plan_name" },
    vip: { type: Sequelize.BOOLEAN, defaultValue: false },
    price: { type: Sequelize.DECIMAL(12, 2), defaultValue: 0 },
    daily: { type: Sequelize.DECIMAL(12, 2), defaultValue: 0 },
    cycle: { type: Sequelize.INTEGER.UNSIGNED, defaultValue: 1 },
    total: { type: Sequelize.DECIMAL(12, 2), defaultValue: 0 },
    status: { type: Sequelize.ENUM("Active", "Completed"), defaultValue: "Active" },
    /* how many daily-income payouts have already been credited */
    paidDays: { type: Sequelize.INTEGER.UNSIGNED, defaultValue: 0, field: "paid_days" },
  },
  { tableName: "invests", underscored: true }
);

module.exports = Invest;
