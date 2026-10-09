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
    refBy: { type: String, default: "", trim: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", UserSchema);
