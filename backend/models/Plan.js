const mongoose = require("mongoose");

const PlanSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    vip: { type: Boolean, default: false },
    price: { type: Number, required: true, min: 0 },
    daily: { type: Number, required: true, min: 0 },
    cycle: { type: Number, required: true, min: 1 },
    total: { type: Number, required: true, min: 0 },
    limit: { type: Number, default: 0 }, // 0 = unlimited
    presale: { type: Boolean, default: false },
    active: { type: Boolean, default: true },
    sort: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Plan", PlanSchema);
