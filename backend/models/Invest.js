const mongoose = require("mongoose");

const InvestSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
    userid: { type: String, default: "", index: true },
    phone: { type: String, default: "", index: true },
    planId: { type: mongoose.Schema.Types.ObjectId, ref: "Plan" },
    planName: { type: String, required: true },
    vip: { type: Boolean, default: false },
    price: { type: Number, required: true },
    daily: { type: Number, required: true },
    cycle: { type: Number, required: true },
    total: { type: Number, required: true },
    status: { type: String, enum: ["Active", "Completed"], default: "Active" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Invest", InvestSchema);
