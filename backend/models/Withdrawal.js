const mongoose = require("mongoose");

const WithdrawalSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
    userid: { type: String, default: "" },
    phone: { type: String, default: "", index: true },
    amount: { type: Number, required: true, min: 0 },
    /* charge snapshot taken at request time (charge % from settings) */
    chargePercent: { type: Number, default: 0 },
    charge: { type: Number, default: 0 }, /* ₹ deducted as charge */
    netAmount: { type: Number, default: 0 }, /* ₹ actually payable to the bank a/c */
    realName: { type: String, default: "" },
    bankName: { type: String, default: "" },
    account: { type: String, default: "" },
    ifsc: { type: String, default: "" },
    status: {
      type: String,
      enum: ["Pending", "Processing", "Success", "Rejected"],
      default: "Pending",
      index: true,
    },
    note: { type: String, default: "" },
    processedAt: { type: Date },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Withdrawal", WithdrawalSchema);
