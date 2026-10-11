const mongoose = require("mongoose");

const DepositSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
    userid: { type: String, default: "" },
    phone: { type: String, default: "", index: true },
    amount: { type: Number, required: true, min: 0 },
    method: { type: String, default: "Pay-T" },
    status: {
      type: String,
      enum: ["Pending", "Success", "Rejected"],
      default: "Pending",
      index: true,
    },
    note: { type: String, default: "" },
    processedAt: { type: Date },
    /* QwackPay auto-gateway tracking (method "QwackPay" orders only) */
    gateway: { type: String, default: "" }, // "qwackpay"
    gatewayOrderId: { type: String, default: "" }, // QwackPay's qwack_order_id
    paymentUrl: { type: String, default: "" }, // hosted checkout link returned by the gateway
    utr: { type: String, default: "" }, // bank UTR from the success callback
  },
  { timestamps: true }
);

module.exports = mongoose.model("Deposit", DepositSchema);
