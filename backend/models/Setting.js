const mongoose = require("mongoose");

const SettingSchema = new mongoose.Schema(
  {
    key: { type: String, default: "global", unique: true },
    commission: {
      level1: { type: Number, default: 25 },
      level2: { type: Number, default: 3 },
      level3: { type: Number, default: 2 },
    },
    site: {
      loginTitle: { type: String, default: "Login" },
      loginSubtitle: { type: String, default: "" },
      registerTitle: { type: String, default: "Register" },
      registerSubtitle: { type: String, default: "" },
      homeSubtitle: { type: String, default: "Earn daily, withdraw daily" },
      announcement: { type: String, default: "" },
      telegramUrl: { type: String, default: "" },
      downloadUrl: { type: String, default: "" },
      supportUrl: { type: String, default: "" },
      minRecharge: { type: Number, default: 530 },
      minWithdraw: { type: Number, default: 130 },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Setting", SettingSchema);
