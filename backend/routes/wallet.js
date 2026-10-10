const router = require("express").Router();
const bcrypt = require("bcryptjs");
const userAuth = require("../middleware/userAuth");
const User = require("../models/User");
const Invest = require("../models/Invest");
const Deposit = require("../models/Deposit");
const Withdrawal = require("../models/Withdrawal");
const Plan = require("../models/Plan");
const Setting = require("../models/Setting");
const Transaction = require("../models/Transaction");
const { emitToUser, emitAdmin } = require("../live");

/* ============ WALLET SUMMARY (profile/home) ============ */
router.get("/wallet", userAuth, async (req, res) => {
  const u = req.user;
  res.json({
    success: true,
    wallet: {
      balance: u.balance,
      rechargeBalance: u.rechargeBalance,
      totalRecharge: u.totalRecharge || 0,
      totalIncome: u.totalIncome,
      userid: u.userid,
      refId: u.refId,
      phone: u.phone,
      name: u.name,
      status: u.status,
      bank: u.bank || null,
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

    /* Recharge limits — from the admin recharge setting (server-side validation) */
    const s = await Setting.findOne({ key: "global" }).lean();
    const rc = (s && s.recharge) || {};
    const minR = Number(rc.minAmount) || 0;
    const maxR = Number(rc.maxAmount) || 0;
    if (minR && amount < minR)
      return res
        .status(400)
        .json({ success: false, message: "Minimum recharge is \u20B9" + minR });
    if (maxR && amount > maxR)
      return res
        .status(400)
        .json({ success: false, message: "Maximum recharge is \u20B9" + maxR });

    const deposit = await Deposit.create({
      user: req.user._id,
      userid: req.user.userid || "",
      phone: req.user.phone,
      amount,
      method,
      status: "Pending",
    });

    /* ledger entry — the transaction history page reads these records */
    await Transaction.create({
      user: req.user._id,
      userid: req.user.userid || "",
      phone: req.user.phone,
      type: "recharge",
      title: "Recharge",
      method,
      amount,
      status: "Pending",
      refId: String(deposit._id),
    });

    /* realtime — alert the admin panel instantly */
    emitAdmin("txns:new", {
      type: "recharge",
      phone: req.user.phone,
      amount,
      message: "New recharge request — \u20B9" + amount + " from " + req.user.phone,
    });
    /* pages push — /records, /transaction, /card show the request live */
    emitToUser(req.user.phone, "activity:update", { type: "recharge", status: "Pending" });

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
    /* per-user purchase limit — count the user's ACTIVE holdings of this plan
       (re-buying is allowed again once a cycle completes) */
    if (plan.limit > 0) {
      const activeCount = await Invest.countDocuments({
        user: req.user._id,
        planId: plan._id,
        status: "Active",
      });
      if (activeCount >= plan.limit)
        return res.status(400).json({
          success: false,
          message:
            "Plan limit reached — you already hold the maximum active purchases of this plan",
        });
    }
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

    /* invite commission — L1/L2/L3 on the plan price (refBy = the referrer's refId) */
    try {
      const s = await Setting.findOne({ key: "global" });
      const rates = s ? s.commission : { level1: 25, level2: 3, level3: 2 };
      let refCode = req.user.refBy;
      let level = 1;
      while (refCode && level <= 3) {
        const ref = await User.findOne({ refId: refCode });
        if (!ref) break;
        const rate = rates["level" + level] || 0;
        const amt = +(((plan.price * rate) / 100).toFixed(2));
        if (amt > 0) {
          await User.updateOne({ _id: ref._id }, { $inc: { balance: amt } });
          /* ledger entry — the referrer sees this in the transaction history */
          await Transaction.create({
            user: ref._id,
            userid: ref.userid || "",
            phone: ref.phone,
            type: "commission",
            title: "Team Commission",
            method: "Level " + level + " (" + rate + "%) — plan bought by " + req.user.phone,
            amount: amt,
            status: "Success",
          });
        }
        refCode = ref.refBy; /* next level up the chain */
        level++;
      }
    } catch (e) {
      console.error("commission error:", e.message);
    }

    /* ledger entry — "Buy Plan" shows in the transaction history */
    await Transaction.create({
      user: req.user._id,
      userid: req.user.userid || "",
      phone: req.user.phone,
      type: "invest",
      title: "Buy Plan",
      method: plan.name,
      amount: plan.price,
      status: "Success",
      refId: String(invest._id),
    });

    /* realtime — push the new recharge balance to the buyer's other tabs */
    emitToUser(req.user.phone, "wallet:refresh", { reason: "invest" });
    /* pages push — /records shows the new plan instantly */
    emitToUser(req.user.phone, "activity:update", { type: "invest" });

    res.json({
      success: true,
      message: "Plan purchased successfully!",
      order: {
        id: "ZP" + String(Date.now()).slice(-8),
        planId: plan._id,
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

    const s = await Setting.findOne({ key: "global" }).lean();
    const wdCfg = (s && s.withdraw) || {};
    const minW = Number(wdCfg.minAmount) || (s && s.site && s.site.minWithdraw) || 130;
    const maxW = Number(wdCfg.maxAmount) || 0;
    /* withdrawal charge % — set from the admin panel, deducted from the request
       (?? 10 keeps the model default for pre-existing Setting docs without the field) */
    const chargePct = Math.min(100, Math.max(0, Number(wdCfg.chargePercent ?? 10)));
    const charge = Math.round(amount * chargePct) / 100;
    const netAmount = +(amount - charge).toFixed(2);

    /* master switch — one click in the admin panel stops ALL withdrawals */
    if (wdCfg.enabled === false)
      return res
        .status(403)
        .json({ success: false, message: "Withdrawals are temporarily stopped by the admin" });

    /* IST time window — requests allowed only between start & end time (overnight-safe) */
    const nowIst = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Kolkata",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date()); // "HH:MM"
    const winStart = String(wdCfg.startTime || "00:00");
    const winEnd = String(wdCfg.endTime || "23:59");
    if (winStart !== winEnd) {
      const inWindow =
        winStart <= winEnd
          ? nowIst >= winStart && nowIst <= winEnd
          : nowIst >= winStart || nowIst <= winEnd;
      if (!inWindow)
        return res.status(403).json({
          success: false,
          message:
            "Withdrawals are open between " + winStart + " and " + winEnd + " (IST) only",
        });
    }

    /* daily limit — max withdrawal requests per user per day (IST calendar day) */
    const dailyLimit = Math.min(99, Math.max(0, Number(wdCfg.dailyLimit) || 0));
    if (dailyLimit > 0) {
      const todayIst = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Kolkata",
      }).format(new Date()); // "YYYY-MM-DD"
      const dayStartUtc = new Date(todayIst + "T00:00:00+05:30");
      const doneToday = await Withdrawal.countDocuments({
        user: req.user._id,
        createdAt: { $gte: dayStartUtc },
      });
      if (doneToday >= dailyLimit)
        return res.status(403).json({
          success: false,
          message: "Daily withdrawal limit reached (" + dailyLimit + " per day)",
        });
    }

    if (!amount || amount <= 0)
      return res
        .status(400)
        .json({ success: false, message: "Enter the withdrawal amount" });
    if (amount < minW)
      return res
        .status(400)
        .json({ success: false, message: "Minimum withdrawal is \u20B9" + minW });
    if (maxW && amount > maxW)
      return res
        .status(400)
        .json({ success: false, message: "Maximum withdrawal is \u20B9" + maxW });
    if (!bank || !bank.realName || !bank.account || !bank.ifsc || !bank.bankName)
      return res
        .status(400)
        .json({ success: false, message: "Bind your bank card first" });
    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(String(bank.ifsc || "").toUpperCase()))
      return res.status(400).json({ success: false, message: "IFSC code wrong" });
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
      chargePercent: chargePct,
      charge,
      netAmount,
      realName: bank.realName,
      bankName: bank.bankName,
      account: bank.account,
      ifsc: bank.ifsc,
      status: "Pending",
    });

    /* save the bank card on the user (admin can view it in Manage Users) */
    await User.updateOne(
      { _id: req.user._id },
      {
        bank: {
          realName: String(bank.realName || ""),
          bankName: String(bank.bankName || ""),
          account: String(bank.account || ""),
          ifsc: String(bank.ifsc || ""),
        },
      }
    );

    /* ledger entry — amount is the NET the user receives (after the charge),
       so /transaction shows ₹180 for a ₹200 request with a 10% fee */
    await Transaction.create({
      user: req.user._id,
      userid: req.user.userid || "",
      phone: req.user.phone,
      type: "withdraw",
      title: "Withdrawal",
      amount: netAmount,
      chargePercent: chargePct,
      charge,
      netAmount,
      status: "Pending",
      refId: String(wd._id),
    });

    /* realtime — alert the admin panel + sync the user's other tabs */
    emitAdmin("txns:new", {
      type: "withdraw",
      phone: req.user.phone,
      amount,
      netAmount,
      charge,
      message:
        "New withdrawal request — \u20B9" + amount + " (receive \u20B9" + netAmount + ") from " + req.user.phone,
    });
    emitToUser(req.user.phone, "wallet:refresh", { reason: "withdraw" });
    /* pages push — /records, /transaction, /withdrawal add the request live */
    emitToUser(req.user.phone, "activity:update", { type: "withdraw", status: "Pending" });

    res.json({
      success: true,
      message: "Withdrawal request submitted!",
      withdrawal: {
        id: wd._id,
        amount: wd.amount,
        chargePercent: chargePct,
        charge,
        netAmount,
        status: wd.status,
      },
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

/* ============ BANK CARD — save the payout account from the /card page ============
   The card used to live only in the browser's localStorage, so it disappeared
   whenever that storage got cleared (or the user switched device). It is now
   saved on the user document server-side and restored from there. */
router.put("/bank", userAuth, async (req, res) => {
  try {
    const { realName, ifsc, account, bankName } = req.body || {};
    const name = String(realName || "").trim().slice(0, 30);
    const code = String(ifsc || "").trim().toUpperCase();
    const acc = String(account || "").trim();
    const bank = String(bankName || "").trim().slice(0, 30);
    if (name.length < 3)
      return res
        .status(400)
        .json({ success: false, message: "Enter your real name" });
    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(code))
      return res
        .status(400)
        .json({ success: false, message: "Enter a valid IFSC code" });
    if (!/\d{9,18}/.test(acc))
      return res
        .status(400)
        .json({ success: false, message: "Enter a valid bank account number" });
    if (!bank)
      return res
        .status(400)
        .json({ success: false, message: "Enter bank name" });

    await User.updateOne(
      { _id: req.user._id },
      { bank: { realName: name, bankName: bank, account: acc, ifsc: code } }
    );
    res.json({
      success: true,
      message: "Bank card saved successfully!",
      bank: { realName: name, bankName: bank, account: acc, ifsc: code },
    });
  } catch (e) {
    console.error("bank save error:", e.message);
    res.status(500).json({ success: false, message: "Failed to save bank card" });
  }
});

/* ============ TRANSACTION HISTORY (ledger) ============ */
router.get("/invests", userAuth, async (req, res) => {
  try {
    const invests = await Invest.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();
    res.json({
      success: true,
      invests: invests.map((iv) => ({
        id: "ZP" + String(iv._id).slice(-8),
        planId: iv.planId,
        name: iv.planName,
        vip: !!iv.vip,
        price: iv.price,
        daily: iv.daily,
        cycle: iv.cycle,
        total: iv.total,
        boughtAt: iv.createdAt,
        status: iv.status,
        paidDays: iv.paidDays || 0,
      })),
    });
  } catch (e) {
    res.status(500).json({ success: false, message: "Failed to load orders" });
  }
});

router.get("/transactions", userAuth, async (req, res) => {
  try {
    const txns = await Transaction.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
    res.json({ success: true, txns });
  } catch (e) {
    console.error("transactions error:", e.message);
    res.status(500).json({ success: false, message: "Failed to load transactions" });
  }
});

module.exports = router;
