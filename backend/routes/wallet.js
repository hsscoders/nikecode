const router = require("express").Router();
const bcrypt = require("bcryptjs");
const userAuth = require("../middleware/userAuth");
const User = require("../models/User");
const Invest = require("../models/Invest");
const Deposit = require("../models/Deposit");
const Withdrawal = require("../models/Withdrawal");
const Plan = require("../models/Plan");
const Setting = require("../models/Setting");

/* ============ WALLET SUMMARY (profile/home) ============ */
router.get("/wallet", userAuth, async (req, res) => {
  const u = req.user;
  res.json({
    success: true,
    wallet: {
      balance: u.balance,
      rechargeBalance: u.rechargeBalance,
      totalIncome: u.totalIncome,
      userid: u.userid,
      refId: u.refId,
      phone: u.phone,
      name: u.name,
      status: u.status,
    },
  });
});

/* ============ DEPOSIT REQUEST (recharge page) ============ */
router.post("/deposit", userAuth, async (req, res) => {
  try {
    const amount = Math.floor(Number(req.body && req.body.amount));
    const method = String((req.body && req.body.method) || "Pay-T");
    if (!amount || amount <= 0)
      return res
        .status(400)
        .json({ success: false, message: "Enter a valid amount" });

    const deposit = await Deposit.create({
      user: req.user._id,
      userid: req.user.userid || "",
      phone: req.user.phone,
      amount,
      method,
      status: "Pending",
    });

    res.json({
      success: true,
      message: "Recharge request submitted!",
      deposit: {
        id: deposit._id,
        amount: deposit.amount,
        method: deposit.method,
        status: deposit.status,
      },
    });
  } catch (e) {
    console.error("deposit error:", e.message);
    res.status(500).json({ success: false, message: "Server error, please try again" });
  }
});

/* ============ INVEST (buy plan) ============ */
router.post("/invest", userAuth, async (req, res) => {
  try {
    const planId = req.body && req.body.planId;
    const plan = await Plan.findById(planId);
    if (!plan || !plan.active)
      return res.status(400).json({ success: false, message: "Plan not available" });
    if (plan.presale)
      return res
        .status(400)
        .json({ success: false, message: "This plan is in pre-sale" });
    if (req.user.rechargeBalance < plan.price)
      return res.status(400).json({
        success: false,
        message: "Insufficient recharge balance. Please recharge first.",
      });

    /* atomic deduct — race safe */
    const upd = await User.updateOne(
      { _id: req.user._id, rechargeBalance: { $gte: plan.price } },
      { $inc: { rechargeBalance: -plan.price } }
    );
    if (upd.modifiedCount === 0)
      return res.status(400).json({
        success: false,
        message: "Insufficient recharge balance. Please recharge first.",
      });

    const invest = await Invest.create({
      user: req.user._id,
      userid: req.user.userid || "",
      phone: req.user.phone,
      planId: plan._id,
      planName: plan.name,
      vip: plan.vip,
      price: plan.price,
      daily: plan.daily,
      cycle: plan.cycle,
      total: plan.total,
      status: "Active",
    });

    /* invite commission — L1/L2/L3 (refBy = referrer ka refId) */
    try {
      const s = await Setting.findOne({ key: "global" });
      const rates = s ? s.commission : { level1: 25, level2: 3, level3: 2 };
      let refCode = req.user.refBy;
      for (const lvl of ["level1", "level2", "level3"]) {
        if (!refCode) break;
        const ref = await User.findOne({ refId: refCode });
        if (!ref) break;
        const amt = +(((plan.price * (rates[lvl] || 0)) / 100).toFixed(2));
        if (amt > 0)
          await User.updateOne({ _id: ref._id }, { $inc: { balance: amt } });
        refCode = ref.refBy; /* agla level upar */
      }
    } catch (e) {
      console.error("commission error:", e.message);
    }

    res.json({
      success: true,
      message: "Plan purchased successfully!",
      order: {
        id: "ZP" + String(Date.now()).slice(-8),
        name: invest.planName,
        vip: invest.vip,
        price: invest.price,
        daily: invest.daily,
        cycle: invest.cycle,
        total: invest.total,
        boughtAt: invest.createdAt,
        status: "Active",
      },
      wallet: {
        balance: req.user.balance,
        rechargeBalance: +(req.user.rechargeBalance - plan.price).toFixed(2),
        totalIncome: req.user.totalIncome,
      },
    });
  } catch (e) {
    console.error("invest error:", e.message);
    res.status(500).json({ success: false, message: "Server error, please try again" });
  }
});

/* ============ WITHDRAW REQUEST ============ */
router.post("/withdraw", userAuth, async (req, res) => {
  try {
    const { withdraw_password, bank } = req.body || {};
    const amount = Math.floor(Number(req.body && req.body.amount));

    const s = await Setting.findOne({ key: "global" });
    const minW = (s && s.site && s.site.minWithdraw) || 130;

    if (!amount || amount <= 0)
      return res
        .status(400)
        .json({ success: false, message: "Enter the withdrawal amount" });
    if (amount < minW)
      return res
        .status(400)
        .json({ success: false, message: "Minimum withdrawal is \u20B9" + minW });
    if (!bank || !bank.realName || !bank.account || !bank.ifsc || !bank.bankName)
      return res
        .status(400)
        .json({ success: false, message: "Bind your bank card first" });
    if (!withdraw_password)
      return res
        .status(400)
        .json({ success: false, message: "Enter the withdrawal password" });

    const ok = await bcrypt.compare(String(withdraw_password), req.user.withdrawPassword);
    if (!ok)
      return res
        .status(400)
        .json({ success: false, message: "Incorrect withdrawal password" });

    if (req.user.balance < amount)
      return res
        .status(400)
        .json({ success: false, message: "Insufficient balance" });

    const upd = await User.updateOne(
      { _id: req.user._id, balance: { $gte: amount } },
      { $inc: { balance: -amount } }
    );
    if (upd.modifiedCount === 0)
      return res
        .status(400)
        .json({ success: false, message: "Insufficient balance" });

    const wd = await Withdrawal.create({
      user: req.user._id,
      userid: req.user.userid || "",
      phone: req.user.phone,
      amount,
      realName: bank.realName,
      bankName: bank.bankName,
      account: bank.account,
      ifsc: bank.ifsc,
      status: "Pending",
    });

    res.json({
      success: true,
      message: "Withdrawal request submitted!",
      withdrawal: { id: wd._id, amount: wd.amount, status: wd.status },
      wallet: {
        balance: +(req.user.balance - amount).toFixed(2),
        rechargeBalance: req.user.rechargeBalance,
        totalIncome: req.user.totalIncome,
      },
    });
  } catch (e) {
    console.error("withdraw error:", e.message);
    res.status(500).json({ success: false, message: "Server error, please try again" });
  }
});

module.exports = router;
