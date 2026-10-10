const mongoose = require("mongoose");

const AdminSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    password: { type: String, required: true }, // bcrypt hash
    name: { type: String, default: "Administrator", trim: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Admin", AdminSchema);
