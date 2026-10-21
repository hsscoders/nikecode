const { sequelize, Sequelize } = require("../db");

/* users — was models/User.js (Mongoose). `bank` is a VIRTUAL that reads/
   writes the four flat columns so existing code (`user.bank.realName`)
   keeps working unchanged. */
const User = sequelize.define(
  "User",
  {
    id: { type: Sequelize.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
    legacyId: { type: Sequelize.CHAR(24), field: "legacy_id" },
    phone: { type: Sequelize.STRING(10), unique: true, validate: { is: /^[6-9]\d{9}$/ } },
    password: { type: Sequelize.STRING(100) }, // bcrypt hash (login)
    withdrawPassword: { type: Sequelize.STRING(100), field: "withdraw_password" }, // bcrypt hash
    refBy: { type: Sequelize.STRING(20), defaultValue: "", field: "ref_by" },
    userid: { type: Sequelize.STRING(20), unique: true },
    refId: { type: Sequelize.STRING(20), unique: true, field: "ref_id" },
    name: { type: Sequelize.STRING(40), defaultValue: "" },
    balance: { type: Sequelize.DECIMAL(12, 2), defaultValue: 0 },
    rechargeBalance: { type: Sequelize.DECIMAL(12, 2), defaultValue: 0, field: "recharge_balance" },
    totalRecharge: { type: Sequelize.DECIMAL(12, 2), defaultValue: 0, field: "total_recharge" },
    totalIncome: { type: Sequelize.DECIMAL(12, 2), defaultValue: 0, field: "total_income" },
    status: { type: Sequelize.ENUM("Active", "Banned"), defaultValue: "Active" },
    bankRealName: { type: Sequelize.STRING(30), defaultValue: "", field: "bank_real_name" },
    bankBankName: { type: Sequelize.STRING(30), defaultValue: "", field: "bank_bank_name" },
    bankAccount: { type: Sequelize.STRING(24), defaultValue: "", field: "bank_account" },
    bankIfsc: { type: Sequelize.STRING(11), defaultValue: "", field: "bank_ifsc" },
    /* composed bank card — same shape the Mongoose subdoc had */
    bank: {
      type: Sequelize.VIRTUAL,
      get() {
        return {
          realName: this.getDataValue("bankRealName") || "",
          bankName: this.getDataValue("bankBankName") || "",
          account: this.getDataValue("bankAccount") || "",
          ifsc: this.getDataValue("bankIfsc") || "",
        };
      },
    },
  },
  { tableName: "users", underscored: true }
);

module.exports = User;
