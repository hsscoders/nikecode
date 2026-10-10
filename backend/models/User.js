const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema(
  {
    phone: {
      type: String,
      required: true,
      unique: true,
      index: true,
      match: /^[6-9]\d{9}$/,
    },
    password: { type: String, required: true }, // bcrypt hash (login)
    withdrawPassword: { type: String, required: true }, // bcrypt hash (withdrawal)
    refBy: { type: String, default: "", trim: true }, // the referrer's refId
    userid: { type: String, unique: true, sparse: true, index: true }, // ZP + 6 digits
    refId: { type: String, unique: true, sparse: true, index: true }, // ZP + 8 alnum
    name: { type: String, default: "", trim: true },
    balance: { type: Number, default: 0 }, // withdrawal balance
    rechargeBalance: { type: Number, default: 0 }, // recharge wallet (plan buy)
    totalRecharge: { type: Number, default: 0 }, // cumulative successful recharges (never decreases on plan buy)
    totalIncome: { type: Number, default: 0 }, // total plan income
    status: { type: String, enum: ["Active", "Banned"], default: "Active" },
    /* Bank card saved on the first withdrawal (admin can view it in Manage Users) */
    bank: {
      realName: { type: String, default: "" },
      bankName: { type: String, default: "" },
      account: { type: String, default: "" },
      ifsc: { type: String, default: "" },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", UserSchema);
