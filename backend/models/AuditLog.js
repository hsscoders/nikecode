const mongoose = require("mongoose");

/* ============================================================
   AUDIT LOG — immutable activity trail.

   One document per significant event: admin money actions
   (deposit/withdraw status changes, user edits), gateway webhook
   settlements, user auth events and money requests. Written by
   services/audit.js — fire-and-forget, a logging failure can never
   break the main flow. No updates, no deletes from the app: the
   trail stays trustworthy. TLL index auto-prunes after 90 days.
   ============================================================ */

const AuditLogSchema = new mongoose.Schema(
  {
    /* who did it — "admin" (panel action), "user" (client app), or
       "system" (webhooks, cron income credit) */
    actorType: {
      type: String,
      enum: ["admin", "user", "system"],
      required: true,
      index: true,
    },
    actorId: { type: String, default: "" }, /* raw _id as string */
    actorLabel: { type: String, default: "" }, /* admin username / user phone */
    /* what happened — dotted snake_case verb, e.g. deposit.approve */
    action: { type: String, required: true, index: true },
    /* coarse grouping for the admin filter chips */
    category: {
      type: String,
      enum: [
        "auth",
        "deposit",
        "withdraw",
        "invest",
        "user",
        "plan",
        "banner",
        "settings",
        "gateway",
        "system",
      ],
      required: true,
      index: true,
    },
    target: { type: String, default: "" }, /* whom/what it hit (phone, plan id…) */
    /* human summary + structured extras (amounts, statuses, ids) */
    message: { type: String, default: "" },
    detail: { type: mongoose.Schema.Types.Mixed, default: {} },
    ip: { type: String, default: "" },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

/* trail auto-prunes — 90 days of history is plenty for operations */
AuditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });
/* newest-first browsing */
AuditLogSchema.index({ createdAt: -1 });

module.exports = mongoose.model("AuditLog", AuditLogSchema);
