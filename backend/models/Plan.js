const { sequelize, Sequelize } = require("../db");

/* plans — the Mongo field `limit` maps to purchase_limit (`limit` is a
   reserved word in MySQL). */
const Plan = sequelize.define(
  "Plan",
  {
    id: { type: Sequelize.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
    legacyId: { type: Sequelize.CHAR(24), field: "legacy_id" },
    name: { type: Sequelize.STRING(60) },
    vip: { type: Sequelize.BOOLEAN, defaultValue: false },
    image: { type: Sequelize.STRING(500), defaultValue: "" },
    price: { type: Sequelize.DECIMAL(12, 2), defaultValue: 0 },
    daily: { type: Sequelize.DECIMAL(12, 2), defaultValue: 0 },
    cycle: { type: Sequelize.INTEGER.UNSIGNED, defaultValue: 1 },
    total: { type: Sequelize.DECIMAL(12, 2), defaultValue: 0 },
    limit: { type: Sequelize.INTEGER.UNSIGNED, defaultValue: 0, field: "purchase_limit" }, // 0 = unlimited
    presale: { type: Sequelize.BOOLEAN, defaultValue: false },
    active: { type: Sequelize.BOOLEAN, defaultValue: true },
    sort: { type: Sequelize.INTEGER, defaultValue: 0 },
  },
  { tableName: "plans", underscored: true }
);

module.exports = Plan;
