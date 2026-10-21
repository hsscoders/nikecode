const { sequelize, Sequelize } = require("../db");

/* AUDIT LOG — immutable activity trail (was Mongoose with a 90-day TTL).
   MySQL has no TTL index: the daily income cron prunes rows older than
   90 days (same retention as before). No updates, no deletes from the
   app besides that prune. */
const AuditLog = sequelize.define(
  "AuditLog",
  {
    id: { type: Sequelize.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
    legacyId: { type: Sequelize.CHAR(24), field: "legacy_id" },
    actorType: {
      type: Sequelize.ENUM("admin", "user", "system"),
      field: "actor_type",
    },
    actorId: { type: Sequelize.STRING(40), defaultValue: "", field: "actor_id" },
    actorLabel: { type: Sequelize.STRING(60), defaultValue: "", field: "actor_label" },
    action: { type: Sequelize.STRING(60) },
    category: {
      type: Sequelize.ENUM(
        "auth",
        "deposit",
        "withdraw",
        "invest",
        "user",
        "plan",
        "banner",
        "settings",
        "gateway",
        "system"
      ),
    },
    target: { type: Sequelize.STRING(120), defaultValue: "" },
    message: { type: Sequelize.STRING(400), defaultValue: "" },
    detail: {
      type: Sequelize.JSON,
      get() {
        const v = this.getDataValue("detail");
        if (v == null) return {};
        return typeof v === "string" ? JSON.parse(v) : v;
      },
    },
    ip: { type: Sequelize.STRING(64), defaultValue: "" },
  },
  {
    tableName: "audit_logs",
    underscored: true,
    updatedAt: false, /* createdAt only — immutable trail */
  }
);

module.exports = AuditLog;
