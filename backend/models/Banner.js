const { sequelize, Sequelize } = require("../db");

const Banner = sequelize.define(
  "Banner",
  {
    id: { type: Sequelize.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
    legacyId: { type: Sequelize.CHAR(24), field: "legacy_id" },
    title: { type: Sequelize.STRING(80), defaultValue: "" },
    image: { type: Sequelize.STRING(500) },
    originUrl: { type: Sequelize.STRING(500), defaultValue: "", field: "origin_url" },
    link: { type: Sequelize.STRING(500), defaultValue: "" },
    active: { type: Sequelize.BOOLEAN, defaultValue: true },
    sort: { type: Sequelize.INTEGER, defaultValue: 0 },
  },
  { tableName: "banners", underscored: true }
);

module.exports = Banner;
