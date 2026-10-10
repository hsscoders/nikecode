const mongoose = require("mongoose");

/* Unified wallet ledger — recharge, withdraw, invite commission and daily plan income */
const TransactionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
    userid: { type: String, default: "", index: true },
    phone: { type: String, default: "", index: true },
    type: {
      type: String,
      enum: ["recharge", "withdraw", "commission", "income"],
      default: "recharge",
      index: true,
    },
    title: { type: String, default: "" },
    method: { type: String, default: "" },
    amount: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ["Pending", "Success", "Rejected"],
      default: "Pending",
      index: true,
    },
    /* Linked record id (deposit / withdrawal) so status changes stay in sync */
    refId: { type: String, default: "", index: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Transaction", TransactionSchema);
