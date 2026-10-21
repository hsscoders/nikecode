const { sequelize, Sequelize } = require("../db");

const Admin = sequelize.define(
  "Admin",
  {
    id: { type: Sequelize.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
    legacyId: { type: Sequelize.CHAR(24), field: "legacy_id" },
    username: { type: Sequelize.STRING(40), unique: true },
    password: { type: Sequelize.STRING(100) }, // bcrypt hash
    name: { type: Sequelize.STRING(60), defaultValue: "Administrator" },
  },
  { tableName: "admins", underscored: true }
);

module.exports = Admin;
